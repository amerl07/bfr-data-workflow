# bfr-data-workflow

Data ingestion pipeline for Berkeley Formula Racing's aero CFD workflow:
watches a shared Google Drive folder for Sabalcore `post.zip` outputs,
parses them into structured rows, and keeps a central, queryable record of
sim results instead of scattered per-person spreadsheets.

**Status:** the full pipeline is implemented, running, and has been
verified end-to-end on a real upload (2026-07-29) -- drop a `post.zip` in
the watched Drive folder and a row shows up in `data/results.csv` with no
manual steps. `ingestion/parsers/folder_name_parser.py` is still a stub
(batch folders are out of current scope -- see `CONTRIBUTING.md`'s
"Current scope" note), so rows involving a batch folder are left "blocked"
in the queue rather than silently skipped or faked.

## Tools & where things live

Every stage of this pipeline runs on a different piece of infrastructure --
worth knowing before debugging or handing this off:

| Stage | Tool | Where it runs / is hosted |
|---|---|---|
| Watch the Drive folder | Google Apps Script (standalone project, `ingestion/drive-watcher/`) | Google's Apps Script runtime (script.google.com) -- not this repo's CI, not anyone's laptop |
| Detect new uploads | Google Drive API v3 (`Drive.Changes.list`), polled by a 1-minute time-driven trigger | Same Apps Script project. Push notifications (`Drive.Changes.watch` + a web app `doPost`) are still wired up but not relied on -- they never fired reliably; see `ingestion/drive-watcher/README.md` |
| Processing queue | A Google Sheet ("BFR Drive Watcher - Processing Queue", `Queue` tab) | Auto-created in Drive by the Apps Script project on first run; filed into the folder set as `GENERATED_SHEETS_FOLDER_ID` in `Config.gs`. Its ID is `QUEUE_SPREADSHEET_ID` in `ingestion/queue_consumer/main.py` |
| Download, unzip, parse | Python (`ingestion/queue_consumer/`, `ingestion/parsers/`) | -- |
| Run the consumer | GitHub Actions, scheduled every 10 minutes, also manually dispatchable (`.github/workflows/queue_consumer.yml`) | GitHub-hosted runner. Also runnable locally: `.venv/bin/python -m ingestion.queue_consumer.main` |
| Auth for the consumer | A Google Cloud service account (GitHub Actions, headless) or the OAuth installed-app flow (local interactive runs) | Service account key lives in the `GCP_SERVICE_ACCOUNT_JSON` GitHub repo secret; OAuth client secret is `ingestion/queue_consumer/credentials.json` (gitignored, local only). See the "One-time setup" section at the top of `main.py` |
| Result storage | `data/results.csv` | Committed to this GitHub repo -- the current source of truth, see "Where results live, and what's next" below |
| Scene images (post.zip contents) | Left in / re-uploaded to Google Drive as individual files, never copied into this repo | `scene_image_refs` in `data/results.csv` stores Drive view links per image -- see `CONTRIBUTING.md` §4 |
| Source code, version history, CI | This repository | GitHub |

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
