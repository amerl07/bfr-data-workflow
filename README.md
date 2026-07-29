# bfr-data-workflow

Data ingestion pipeline for Berkeley Formula Racing's aero CFD workflow:
watches a shared Google Drive folder for Sabalcore `post.zip` outputs,
parses them into structured rows, and keeps a central, queryable record of
sim results instead of scattered per-person spreadsheets.

**Status:** the drive-watcher (Apps Script) is fully implemented and
running -- it detects a new `post.zip` (or already-unzipped `post_` folder)
and queues it in a Google Sheet, polling `processChanges()` every minute
(see `ingestion/drive-watcher/README.md` for why push notifications were
abandoned in favor of this). The queue consumer (Python) reads that queue,
downloads/unzips each file, runs it through the parsers, and appends a row
to `data/results.csv` -- also now running on a schedule rather than by
hand, see "Automated ingestion" below. `ingestion/parsers/folder_name_parser.py`
is still a stub (batch folders are out of current scope -- see
`CONTRIBUTING.md`'s "Current scope" note), so rows involving a batch folder
are left "blocked" in the queue rather than silently skipped or faked.

## Repo layout

```
docs/                    Design docs and open questions -- read these first.
ingestion/
  drive-watcher/          Google Apps Script: watches the Drive batch folder
                           for new batch folders / post.zip uploads, queues
                           detections in a Google Sheet. Polls every minute
                           (push notifications proved unreliable -- see its
                           own README). Implemented, running.
  queue_consumer/          Python: reads the queue sheet, downloads/unzips
                           each post.zip, calls the parsers below, writes
                           data/results.csv rows. Runs on a schedule via
                           .github/workflows/queue_consumer.yml.
  parsers/                 Python: folder-name parser (still a stub -- batch
                           folders out of current scope), Sabalcore
                           .sim/post.zip filename parser, post.zip file
                           classifier, force_reports.txt parser (all three
                           implemented).
.github/
  workflows/               queue_consumer.yml -- scheduled + manually
                           dispatchable run of the queue consumer.
data/
  results.csv             One row per post.zip processed -- the actual
                           tracked deliverable (unlike raw sim outputs,
                           this file IS committed to the repo).
```

## Automated ingestion

`.github/workflows/queue_consumer.yml` runs the queue consumer every 10
minutes (and on manual dispatch), committing any new rows to
`data/results.csv` back to `main`. It authenticates as a service account
rather than the interactive OAuth flow used for local runs -- see the
"One-time setup" section at the top of `ingestion/queue_consumer/main.py`
for how to create one and wire its key into the `GCP_SERVICE_ACCOUNT_JSON`
repo secret. Don't forget to share both the watched Drive folder and the
queue spreadsheet with the service account's email; it doesn't inherit
access from whoever created it.

## Where results live, and what's next

`data/results.csv`, committed to this repo, is the source of truth for now
-- simplest option, versioned, easy to diff/inspect, and the automated
workflow above keeps it current without anyone running the consumer by
hand. The plan is to build a small webapp/query interface on top of it once
there's enough real data to make that worth doing; at that point the likely
next step is migrating storage to a proper queryable database (e.g. a
hosted Postgres) that both the consumer writes to and the webapp reads
from, rather than parsing CSV on every request. Revisit this decision if
concurrent writes, row volume, or the CSV-as-git-history noise become
actual problems before then.

## Docs

- [`docs/Aero Subsystem Data Workflow — Proposal Outline.md`](<docs/Aero Subsystem Data Workflow — Proposal Outline.md>)
  — problem statement, goals, proposed workflow, and open questions.
- [`docs/BFR Sabalcore HPC — Usage Guide.md`](<docs/BFR Sabalcore HPC — Usage Guide.md>)
  — how jobs get submitted to Sabalcore and what comes back.
- [`docs/post_zip_file_format_spec.md`](docs/post_zip_file_format_spec.md)
  — file categories inside a `post.zip`, based on one observed batch;
  documents the target `data/results.csv` schema (§7) and the current open
  questions on file-naming ambiguity.

## Naming conventions

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the living reference on the
Drive batch-folder convention and the Sabalcore `.sim`/`post.zip` filename
convention, plus the consolidated list of open questions.

**Current scope:** `post_<job_name>.zip` is the only artifact type this
pipeline ingests right now -- see the scope note at the top of
`CONTRIBUTING.md` before adding support for other file types (e.g. a future
CSV trials log).
