# drive-watcher

Google Apps Script project that watches the shared Drive folder batch
outputs get dropped into, and fires (push-based, not polling) when a new
batch folder, post.zip, or unzipped post folder shows up.

**Status:** all six `.gs` files are implemented and running. Watch channel
registered, daily renewal trigger installed, and the full detection chain
(`doPost` → `processChanges` → `BatchFolderDetector` → `Dispatcher` → queue
row) has been confirmed working end-to-end against a real `post.zip` drop.
`ingestion/queue_consumer/` (Python) now reads that queue -- see its own
docstring -- though it's still blocked downstream on `ingestion/parsers/`'s
stubs.

## Files

- `appsscript.json` — project manifest (Drive v3 advanced service, web app
  config).
- `Config.gs` — `WATCHED_FOLDER_ID`, `WEBHOOK_URL`, and the Script Properties
  keys used to persist watch-channel and queue state across executions.
- `WatchChannel.gs` — start/stop/check the Drive push-notification channel.
  **Implemented, run.**
- `WebhookHandler.gs` — `doPost`, the entry point Drive calls. **Implemented**
  (see "Header limitation" below for a real constraint this works around).
- `ChangeProcessor.gs` — pulls the actual change list once notified, routes
  each change to `BatchFolderDetector` and relevant ones on to `Dispatcher`.
  **Implemented, confirmed working.**
- `BatchFolderDetector.gs` — filters the account-wide change feed down to
  new batch folders / new post jobs (zipped or unzipped) inside
  `WATCHED_FOLDER_ID`. **Implemented.**
- `Dispatcher.gs` — hands a detected post job off via a Google Sheet
  processing queue (self-provisioned on first use). **Implemented** -- see
  "Processing queue" below.
- `RenewalTrigger.gs` — keeps the watch channel alive (channels expire; this
  is subscription bookkeeping, not file polling). **Implemented, run.**

## Post job shapes: zipped or already-unzipped

`BatchFolderDetector.gs` treats two Drive shapes as an equivalent "new post
job" event, either inside a batch folder or dropped loose directly under
`WATCHED_FOLDER_ID`:
- `post_<job_name>.zip` (a file) -- the documented Sabalcore output.
- `post_<job_name>` (a folder, no `.zip`) -- an already-unzipped version.
  Supported so its scene images are already individually addressable Drive
  files with no extraction step needed (see CONTRIBUTING.md §4's "link
  only" image decision).

Both land in the same processing queue; `ingestion/queue_consumer/` handles
either shape (see its `materialize_post_contents`). One thing to watch: the
queue consumer re-uploads extracted images from a *zipped* post.zip into a
sibling `<job_name>_extracted` Drive folder so they're individually
link-able too -- that folder is deliberately named without a `post_` prefix
so it isn't mistaken for a new post job and reprocessed in a loop. Don't
rename generated `*_extracted` folders to start with `post_`.

## Processing queue

`Dispatcher.handOffNewFile` appends a row (timestamp, file id/name, batch
folder id/name, `status: pending`) to a "Queue" sheet in a spreadsheet it
creates on first use (title `BFR Drive Watcher - Processing Queue`; its ID
is persisted in Script Properties as `DRIVE_WATCH_QUEUE_SPREADSHEET_ID` so
later calls reuse it). `ingestion/queue_consumer/` reads this queue and
updates each row's status to `processing`, then `done` /
`blocked: <reason>` / `error: <reason>`. Run `ensureQueueSheetExists()` once
from the editor (same reason as `startWatch`/`installRenewalTrigger` -- see
"Running functions" below) if you need to (re-)grant the Sheets scope this
needs.

## Testing the detection chain

To test: drop a file named `post_<anything>.zip`, or a folder named
`post_<anything>` (see "Post job shapes" above), either inside a batch
folder under `WATCHED_FOLDER_ID`, or directly in `WATCHED_FOLDER_ID` itself
(no batch folder required -- see BatchFolderDetector.gs's cases 3/4), then
check the Executions log for `doPost` firing and
`processChanges()`/`handOffNewFile` log lines, and check the queue
spreadsheet for a new row.

If a file was uploaded *before* a code change that affects whether it
matches, pushing the fix alone won't reprocess it -- `Changes.list` only
returns changes since the last recorded page token, and that file's change
event was very likely already consumed (and the page token advanced past
it) the first time `doPost` ran for it, whether or not it matched. To
retest an already-uploaded file after a detection-logic change, either
re-upload it (or make any edit that generates a fresh Drive change event),
or run `processChanges()` manually from the editor -- if the original
change was never actually delivered (e.g. the push notification didn't
arrive at all), that manual call will still pick it up.

## Why not a simple time-driven trigger?

Apps Script's easiest option for "run periodically" is a time-driven
trigger, but that's polling. Drive's `Changes.watch` gives a real push
notification (a webhook POST) instead, at the cost of more setup: it's
account-wide rather than folder-scoped, so filtering has to happen in code,
and the subscription needs periodic renewal. See the module docstring in
`WatchChannel.gs` for the full reasoning.

## One-time manual deploy steps

1. Open this project in the Apps Script editor (`clasp` recommended once
   this project is pushed there — see `.clasp.json` in `.gitignore`, not
   committed).
2. **Deploy → New deployment → Web app.** Execute as: Me. Who has access:
   Anyone.
3. Copy the resulting `/exec` URL into `WEBHOOK_URL` in `Config.gs`.
4. Run `startWatch()` once **from the Apps Script editor UI** (select it in
   the function dropdown, click Run) to register the push-notification
   channel -- see "Running functions" below for why this has to be the
   editor and not `clasp run`.
5. Run `installRenewalTrigger()` once, same way, to install the daily
   channel-renewal check.

## Running functions: editor UI, not `clasp run`

`clasp run-function` (and the underlying Apps Script Execution API,
`scripts.run`) requires the script to be linked to a **standard Google
Cloud project**, not the default one Apps Script auto-creates for a new
`clasp create-script` project. This one is on the default project (confirmed
via `clasp list-apis` failing with "GCP project ID is not set"), so
`clasp run-function startWatch` fails with a permission error no matter how
many times the OAuth consent screen is clicked through in the browser --
that consent is for the editor's own execution context, not for API-based
execution. Manually running functions from the Apps Script editor's Run
button works fine and is the supported path until/unless this project gets
migrated to a standard GCP project.

## Header limitation (discovered while implementing `doPost`)

Drive push notifications carry their metadata (`X-Goog-Resource-State`,
`X-Goog-Channel-ID`, `X-Goog-Channel-Token`, etc.) as HTTP headers on the
notification POST. Apps Script's `doPost(e)` event object has no way to
read arbitrary request headers -- there's no `e.headers`. This is a real
platform limitation, not an unconfirmed assumption, and it rules out the
header-based channel validation originally sketched in this file's TODOs.

**Workaround implemented:** `startWatch()` appends a shared-secret `token`
query parameter to `WEBHOOK_URL` when registering the channel (persisted as
`PROP_WEBHOOK_TOKEN`). Query parameters on the notification URL *are*
readable via `e.parameter` in `doPost`, so `doPost` validates against that
instead. One side effect: since headers aren't readable, `doPost` also
can't distinguish the initial `sync` handshake from a real change
notification -- it doesn't need to, since every validated call just
triggers `processChanges()`, and a no-op check (nothing new since the
persisted page token) is harmless.

## Known open risk

Drive push notifications may still require the receiving domain to be
verified for the associated Cloud project in some configurations.
`script.google.com` deployments have worked for other teams without extra
verification, but this hasn't been confirmed for this project's setup —
verify end-to-end after deploying (create a test file in the watched folder
and confirm `doPost` fires -- check via `Logger.log` output in the Apps
Script editor's Executions panel) before relying on this in production. If
it doesn't work, fall back to a short-interval time-driven trigger calling
`ChangeProcessor.processChanges()` directly.
