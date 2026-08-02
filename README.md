# bfr-data-workflow

Data ingestion pipeline for Berkeley Formula Racing's aero CFD workflow:
watches a shared Google Drive folder for Sabalcore `post.zip` outputs,
parses them into structured rows, and keeps a central, queryable record of
sim results instead of scattered per-person spreadsheets.

**Status:** the full pipeline (detection → queue → parse → `data/results.csv`)
is implemented and has been verified end-to-end on real uploads
(2026-07-29). Drive detection is fully automatic. The consumer side is
designed to run automatically too -- a scheduled GitHub Actions run pinged
by an external cron service, see "Automated ingestion" below -- once its
one-time setup (GitHub secret + cron service) is completed. Until then, or
any time you don't want to wait, run
`.venv/bin/python -m ingestion.queue_consumer.main` (or dispatch the GitHub
Actions workflow manually).
`ingestion/parsers/folder_name_parser.py` is still a stub (batch folders
are out of current scope -- see `CONTRIBUTING.md`'s "Current scope" note),
so rows involving a batch folder are left "blocked" in the queue rather
than silently skipped or faked.

**Web front-end:** `web/` is a Next.js static site (Explorer, Simulation
Detail, Compare, Performance Explorer, Analytics Dashboard) that fetches
`data/results.csv` live at runtime -- see `web/README.md`. Deploys to GitHub
Pages via `.github/workflows/deploy.yml`; Pages source still needs to be
switched to "GitHub Actions" in repo Settings (one-time, not yet done).

## Tools & where things live

Every stage of this pipeline runs on a different piece of infrastructure --
worth knowing before debugging or handing this off:

| Stage | Tool | Where it runs / is hosted |
|---|---|---|
| Watch the Drive folder | Google Apps Script (standalone project, `ingestion/drive-watcher/`) | Google's Apps Script runtime (script.google.com) -- not this repo's CI, not anyone's laptop |
| Detect new uploads | Google Drive API v3 (`Drive.Changes.list`), polled by a 1-minute time-driven trigger | Same Apps Script project. Push notifications (`Drive.Changes.watch` + a web app `doPost`) are still wired up but not relied on -- they never fired reliably; see `ingestion/drive-watcher/README.md` |
| Processing queue | A Google Sheet ("BFR Drive Watcher - Processing Queue", `Queue` tab) | Auto-created in Drive by the Apps Script project on first run; filed into the folder set as `GENERATED_SHEETS_FOLDER_ID` in `Config.gs`. Its ID is `QUEUE_SPREADSHEET_ID` in `ingestion/queue_consumer/main.py` |
| Download, unzip, parse | Python (`ingestion/queue_consumer/`, `ingestion/parsers/`) | -- |
| Run the consumer | GitHub Actions, triggered by an external cron service hitting `workflow_dispatch` (GitHub's own `schedule:` trigger is unreliable -- see "Automated ingestion" below) (`.github/workflows/queue_consumer.yml`) | GitHub-hosted runner. Also runnable locally: `.venv/bin/python -m ingestion.queue_consumer.main` |
| Auth for the consumer | OAuth installed-app credentials, same real Google account for both CI and local runs (not a service account -- see `main.py`'s module docstring for why) | `ingestion/queue_consumer/credentials.json` (OAuth client secret, gitignored, local-only) and `token.json` (cached token + refresh_token, gitignored locally, mirrored into the `GOOGLE_OAUTH_TOKEN_JSON` GitHub repo secret for CI). See the "One-time setup" section at the top of `main.py` |
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
                           data/results.csv rows. Meant to run on a
                           schedule via .github/workflows/queue_consumer.yml,
                           but that schedule isn't reliable right now (see
                           "Automated ingestion" below) -- run manually
                           for the time being.
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

`.github/workflows/queue_consumer.yml` runs the queue consumer and commits
any new rows to `data/results.csv` back to `main`. Two pieces of one-time
setup make that unattended, neither yet done as of this writing:

**1. Auth secret.** The workflow authenticates with the same OAuth
installed-app credentials as a local run -- not a service account (one was
tried first; Drive rejects file creation from service accounts outside a
Shared Drive with a `storageQuotaExceeded` error, and this project doesn't
have Shared Drive creation rights on its Workspace org -- see `main.py`'s
module docstring for the full explanation).
1. Locally, run `.venv/bin/python -m ingestion.queue_consumer.main` once
   (needs `ingestion/queue_consumer/credentials.json` -- see `main.py`'s
   docstring if that doesn't exist yet) to produce
   `ingestion/queue_consumer/token.json`.
2. In this repo's GitHub Settings -> Secrets and variables -> Actions,
   create a repo secret named `GOOGLE_OAUTH_TOKEN_JSON` containing that
   file's full contents.
3. Confirm the OAuth consent screen (Google Cloud Console -> APIs &
   Services -> OAuth consent screen) has User type "Internal" or is
   published "In production" -- an External+Testing app's refresh tokens
   silently expire after 7 days, which would break the scheduled run
   without any obvious error.

**2. A reliable trigger.** GitHub's own `schedule:` trigger (still present
in the workflow as a low-priority fallback) is unreliable: observed runs at
16:41, ~18:05, and 21:17 against a 5-10 minute configured interval -- gaps
of 1.5-3 hours, not minutes (found 2026-07-29). This is a known GitHub
limitation, not a bug in this repo's config -- GitHub explicitly treats
`schedule:` as best-effort/low-priority and can delay or silently drop runs
for hours, especially on private repos. Changing the cron expression
doesn't fix it. `workflow_dispatch` (manual, or triggered via the GitHub
API) doesn't have this problem -- those runs start almost immediately, so
the fix is an external cron service calling that API on a real schedule:
1. Create a fine-grained GitHub personal access token (Settings ->
   Developer settings -> Personal access tokens -> Fine-grained tokens)
   scoped to only this repo, with Actions permission set to
   "Read and write". Nothing else needs write access.
2. Sign up for a free scheduled-HTTP-request service (e.g.
   [cron-job.org](https://cron-job.org)) and create a job:
   - URL: `https://api.github.com/repos/amerl07/bfr-data-workflow/actions/workflows/queue_consumer.yml/dispatches`
   - Method: `POST`
   - Headers: `Authorization: Bearer <the fine-grained PAT>`,
     `Accept: application/vnd.github+json`
   - Body: `{"ref": "main"}`
   - Schedule: as frequently as the service's plan allows (commonly every
     1-5 minutes on free tiers).

Both triggers share the workflow's `concurrency` group, so if the schedule
and the external cron ever overlap, one just waits rather than racing.
Moving the consumer off GitHub Actions entirely onto Google Cloud
Scheduler + Cloud Function/Run would be more "proper" but is real
infrastructure to stand up and maintain -- not pursued given the above
works with no new infra.

## Where results live, and what's next

`data/results.csv`, committed to this repo, is the source of truth for now
-- simplest option, versioned, easy to diff/inspect. (The automated
workflow was meant to keep it current without anyone running the consumer
by hand, but see "Automated ingestion" above -- for now that still means
running it manually.)

**Web front-end:** `web/` queries `data/results.csv` client-side (see
"Web front-end" above and `web/README.md`) -- filterable/groupable on
`component`, `sweep_type`, `isolated_vs_fullcar`, `date`, `owner_initials`,
sortable on the per-label force columns, plus `raw_force_values`/`CoP`/
`CoP_meters`/`scene_image_refs` as detail-page/catch-all fields, per
CONTRIBUTING.md §4. Likely next step: migrate storage to a proper
queryable database (e.g. a hosted Postgres) that both the consumer writes
to and the front-end reads from, rather than parsing CSV on every
request -- revisit once concurrent writes, row volume, or the
CSV-as-git-history noise become actual problems, or once the front-end's
query needs outgrow what's comfortable against a flat file.

## Docs

- [`docs/Team Usage Guide.md`](<docs/Team Usage Guide.md>) — start here if
  you're a team member submitting runs, not building the pipeline: the
  end-to-end workflow, naming convention, and how to use the web app.
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
`{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}` source-file
naming convention (decided 2026-07-29, per
`docs/Aero Subsystem Data Workflow — Proposal Outline.md` §5), plus the
consolidated list of open questions.

**Current scope:** `post_<job_name>.zip` is the only artifact type this
pipeline ingests right now -- see the scope note at the top of
`CONTRIBUTING.md` before adding support for other file types (e.g. a future
CSV trials log).
