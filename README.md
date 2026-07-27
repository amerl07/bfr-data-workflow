# bfr-data-workflow

Data ingestion pipeline for Berkeley Formula Racing's aero CFD workflow:
watches a shared Google Drive folder for Sabalcore `post.zip` outputs,
parses them into structured rows, and keeps a central, queryable record of
sim results instead of scattered per-person spreadsheets.

**Status:** the drive-watcher (Apps Script) is fully implemented and running
-- it detects a new `post.zip` and queues it in a Google Sheet. The queue
consumer (Python) reads that queue, downloads/unzips each file, and is
wired up to call the parsers -- but the parsers themselves
(`ingestion/parsers/`) are still stubs (no sample `force_reports.txt` has
been available to build against), so rows aren't reaching
`data/results.csv` yet. See file-level TODOs throughout.

## Repo layout

```
docs/                    Design docs and open questions -- read these first.
ingestion/
  drive-watcher/          Google Apps Script: watches the Drive batch folder,
                           push-notification-based (not polling), fires on
                           new batch folders / post.zip uploads, queues
                           detections in a Google Sheet. Implemented, running.
  queue_consumer/          Python: reads the queue sheet, downloads/unzips
                           each post.zip, calls the parsers below, writes
                           data/results.csv rows. Plumbing implemented;
                           blocked downstream on the parser stubs.
  parsers/                 Python stubs: folder-name parser, Sabalcore
                           .sim/post.zip filename parser, post.zip file
                           classifier, force_reports.txt parser.
data/
  results.csv             One row per post.zip processed -- the actual
                           tracked deliverable (unlike raw sim outputs,
                           this file IS committed to the repo).
```

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
