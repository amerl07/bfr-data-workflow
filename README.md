# bfr-data-workflow

Data ingestion pipeline for Berkeley Formula Racing's aero CFD workflow:
watches a shared Google Drive folder for Sabalcore `post.zip` outputs,
parses them into structured rows, and keeps a central, queryable record of
sim results instead of scattered per-person spreadsheets.

**Status:** early scaffolding. Directory structure, stub functions, and
docs are in place; no real parsing logic exists yet (no sample
`force_reports.txt` has been available to build against). See file-level
TODOs throughout.

## Repo layout

```
docs/                    Design docs and open questions -- read these first.
ingestion/
  drive-watcher/          Google Apps Script: watches the Drive batch folder,
                           push-notification-based (not polling), fires on
                           new batch folders / post.zip uploads.
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
