# bfr-data-workflow

Data pipeline for Berkeley Formula Racing's aero CFD workflow. It pulls
finished runs' `post.zip` outputs off Sabalcore into a shared Google Drive
folder, parses each one into a row of `data/results.csv`, and serves the
results through a web app, replacing scattered per-person spreadsheets.

**Status:** fully automatic end to end (harvest → detect → queue → parse →
`data/results.csv` → web app). Team members: see
[`Team Usage Guide.md`](<Team Usage Guide.md>) instead of this file.

**Web app:** <https://amerl07.github.io/bfr-data-workflow/>. A Next.js
static site in `web/` (Explorer, Simulation Detail, Compare, Performance
Explorer, Analytics Dashboard). It fetches `data/results.csv` live at
runtime, so new rows appear without a redeploy. Deployed to GitHub Pages
by `.github/workflows/deploy.yml` on pushes that touch `web/`. See
`web/README.md`.

## Tools & where things live

| Stage | Tool | Where it runs |
|---|---|---|
| Export on Sabalcore | STAR-CCM+ macro `docs/export_scenes.java`: scenes → PNG, reports → `force_reports.txt`, and (STRAIGHTLINE runs only) a field-grid sweep → `fields/` | Inside the Sabalcore batch job, after mesh + run |
| Pull finished runs off Sabalcore | Python harvester (`ingestion/harvester/`), SSH/SFTP into the shared `brklyrc01` account. Read-only on Sabalcore | `harvest` job in `.github/workflows/queue_consumer.yml`. Locally: `.venv/bin/python -m ingestion.harvester.main --dry-run` |
| Watch the Drive folder | Google Apps Script (`ingestion/drive-watcher/`), polling `Drive.Changes.list` every minute | Google's Apps Script runtime. Push notifications are wired up but unreliable; see its README |
| Processing queue | Google Sheet "BFR Drive Watcher - Processing Queue" (`Queue` tab) | Created by the Apps Script on first run. ID is `QUEUE_SPREADSHEET_ID` in `ingestion/queue_consumer/main.py` |
| Download, unzip, parse | Python (`ingestion/queue_consumer/`, `ingestion/parsers/`) | `consume` job in `queue_consumer.yml`, which commits new rows to `main`. Locally: `.venv/bin/python -m ingestion.queue_consumer.main` |
| Auth for the consumer | OAuth installed-app credentials for one real Google account (not a service account; see `main.py`'s docstring) | `credentials.json` + `token.json` in `ingestion/queue_consumer/` (gitignored), mirrored into the `GOOGLE_OAUTH_TOKEN_JSON` repo secret for CI |
| Result storage | `data/results.csv` | Committed to this repo; the source of truth |
| Scene images, field data | Uploaded to Drive as individual files, never copied into this repo | Linked from `scene_image_refs` and `field_data_refs` in `results.csv` (`CONTRIBUTING.md` §4) |

## Repo layout

```
docs/                    Design docs, specs, STAR-CCM+ macro and references.
  export_scenes.java      The Sabalcore export macro (see table above).
  presentation_grid/      Recorded field-grid setup the macro's sweep is built from.
ingestion/
  drive-watcher/          Apps Script: detects new post.zips and batch folders
                           in the Drive folder, queues them in the sheet.
  harvester/              Uploads finished runs' post.zips from Sabalcore
                           into the Drive folder (loose, no batch folders yet).
  queue_consumer/         Reads the queue, downloads/unzips each post.zip
                           (including subfolders), runs the parsers, uploads
                           images and field data to Drive, writes results.csv.
  parsers/                Job-name and batch-folder-name parsers, post.zip
                           file classifier, force_reports.txt parser, and
                           field_export_parser.py (fields/ CSVs → one
                           <job>_fields.json per sim).
  tests/                  unittest tests (field export parser so far).
web/                      Next.js web app (see web/README.md).
.github/workflows/        queue_consumer.yml (harvest + consume),
                           deploy.yml (web app → GitHub Pages).
data/results.csv          One row per processed post.zip.
```

## Automated ingestion

Each trigger of `.github/workflows/queue_consumer.yml` runs two independent
jobs. `consume` processes the queue and commits new rows to `main`.
`harvest` uploads newly finished Sabalcore runs, which the drive-watcher
detects and a *later* `consume` run ingests. They're separate so a
Sabalcore failure doesn't block ingestion. One-time setup:

**1. Auth secret.** Run the consumer locally once to produce
`ingestion/queue_consumer/token.json`. Paste its contents into a repo secret
named `GOOGLE_OAUTH_TOKEN_JSON`. The OAuth consent screen must be
"Internal" or published "In production": an External+Testing app's refresh
tokens expire silently after 7 days. (A service account doesn't work:
Drive rejects its uploads outside a Shared Drive, which this Workspace
can't create. Details in `main.py`'s docstring.)

**2. External cron trigger.** GitHub's `schedule:` trigger is best-effort
and was observed running hours late, so it's only a fallback. The real
trigger is [cron-job.org](https://cron-job.org) calling `workflow_dispatch`
every 5 minutes:
- `POST https://api.github.com/repos/amerl07/bfr-data-workflow/actions/workflows/queue_consumer.yml/dispatches`
- Headers: `Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`
- Body: `{"ref": "main"}`

The PAT is a fine-grained token named `bfr-queue-consumer-cron`, scoped to
this repo with Actions read/write. It expires periodically; when it does,
paste a new one into the cron job's header. Overlapping runs queue behind
the workflow's `concurrency` group instead of racing.

**3. Sabalcore password.** The `harvest` job needs a `SABALCORE_PASSWORD`
repo secret (the shared `brklyrc01` SSH password). Locally, put
`SABALCORE_HOST=`, `SABALCORE_USER=`, `SABALCORE_PASSWORD=` in
`ingestion/harvester/.env` (gitignored).

**What the harvester uploads** (full detail in its `main.py` docstring):
runs whose directory has both `post_<job>.zip` and the PBS log
`<job>.o<jobid>` (written after the zip, so half-written zips are never
taken), whose job name ends in `_YYYYMMDD` on or after `HARVEST_SINCE`, and
whose zip isn't already in the queue sheet, `results.csv`, or the Drive
folder. At most 5 per run. Backfill older runs with `--since YYYYMMDD`
(try `--dry-run` first).

**TODO, sweep support in the harvester.** Harvested zips land loose, so a
sweep still has to be moved into its batch folder by hand
(`CONTRIBUTING.md` §1b). Plan: a "sweep" field on the relay app's submit
form, recorded on Sabalcore, used by the harvester as the upload folder.

## Storage: what's next

`data/results.csv` is the source of truth: simple, versioned, easy to diff.
A hosted database (e.g. Postgres) is the likely next step once concurrent
writes, row volume, git-history noise, or the web app's queries outgrow a
flat file.

## Docs

- [`Team Usage Guide.md`](<Team Usage Guide.md>): for team members
  submitting runs and using the web app.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): naming convention
  (`{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}`), batch
  folders, `results.csv` columns, initials registry, open questions.
- [`docs/Aero Subsystem Data Workflow — Proposal Outline.md`](<docs/Aero Subsystem Data Workflow — Proposal Outline.md>):
  problem statement, goals, open questions.
- [`docs/BFR Sabalcore HPC — Usage Guide.md`](<docs/BFR Sabalcore HPC — Usage Guide.md>):
  submitting jobs to Sabalcore.
- [`docs/post_zip_file_format_spec.md`](docs/post_zip_file_format_spec.md):
  what's inside a `post.zip` and the target `results.csv` schema.

**Scope:** `post_<job_name>.zip` is the only artifact type ingested. Read
the scope note at the top of `CONTRIBUTING.md` before adding others.
