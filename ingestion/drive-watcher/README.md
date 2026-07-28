# drive-watcher

Google Apps Script project that watches the shared Drive folder batch
outputs get dropped into, and fires when a new batch folder, post.zip, or
unzipped post folder shows up. **Currently polling-based, not push-based**
-- see "Push notifications never reliably worked" below; that was the
original design intent and the infrastructure for it is still in place,
just not what detection actually depends on right now.

**Status:** all `.gs` files are implemented and running. The full detection
chain (`processChanges` → `BatchFolderDetector` → `Dispatcher` → queue row)
has been confirmed working end-to-end against real `post.zip` drops.
`ingestion/queue_consumer/` (Python) now reads that queue -- see its own
docstring -- though it's still blocked downstream on `ingestion/parsers/`'s
stubs. Detection itself runs on a 1-minute polling trigger
(`installPollingTrigger()`), not the push-notification path.

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

**Two real bugs found and fixed here (2026-07-27):**
- `batch_folder_id`/`batch_folder_name` were being set to `WATCHED_FOLDER_ID`
  itself and its own name whenever a post job was dropped with no batch
  folder, instead of being left blank. Downstream, that made
  `ingestion/queue_consumer/` try to run `folder_name_parser` (a stub) on
  the watched root's name, blocking every loose-drop upload with
  `folder name parsing not yet implemented` -- even though no batch folder
  was actually involved. Fixed by checking the immediate parent against
  `WATCHED_FOLDER_ID` before treating it as a batch folder.
- `sheet.appendRow([new Date(), ...])` was observed to corrupt the row:
  every column ended up holding the same date serial value as column A,
  not the intended distinct values, even though the row read back correctly
  immediately after being written. Root cause not fully confirmed (isolated
  Sheets-API-only writes never reproduced it -- see git history for the
  diagnosis), but switching to a formatted date *string*
  (`Utilities.formatDate(...)`) instead of a raw `Date` object avoids it.

## Testing the detection chain

To test: drop a file named `post_<anything>.zip`, or a folder named
`post_<anything>` (see "Post job shapes" above), either inside a batch
folder under `WATCHED_FOLDER_ID`, or directly in `WATCHED_FOLDER_ID` itself
(no batch folder required -- see BatchFolderDetector.gs's cases 3/4), then
wait up to a minute for the polling trigger and check the Executions log
for `processChanges()`/`handOffNewFile` log lines, and check the queue
spreadsheet for a new row. (If push notifications are also running --
optional, see above -- you might additionally see a `doPost` entry, but
detection doesn't depend on it.)

If a file was uploaded *before* a code change that affects whether it
matches, pushing the fix alone won't reprocess it -- `Changes.list` only
returns changes since the last recorded page token, and that file's change
event was very likely already consumed (and the page token advanced past
it) the first time `processChanges()` ran, whether or not it matched. To
retest an already-uploaded file after a detection-logic change, either
re-upload it (or make any edit that generates a fresh Drive change event),
or run `processChanges()` manually from the editor to force an immediate
check instead of waiting for the next 1-minute tick.

## Deployments are frozen snapshots -- `clasp push` alone doesn't update them

Found the hard way (2026-07-27): `WEBHOOK_URL` (Config.gs) points at a
specific **deployment**, not at HEAD. `clasp push` only updates HEAD/dev --
an existing deployment keeps serving whatever code was live when it was
created (or last explicitly redeployed) until you run
`clasp update-deployment <deploymentId>` (aka `clasp redeploy`).

In this project's case, `WEBHOOK_URL` had been pointing at deployment `@1`
("Drive watcher webhook v1") since the very first manual deploy step --
made *before* `WatchChannel.gs`/`WebhookHandler.gs` were implemented, back
when `doPost` was still `throw new Error('TODO: not implemented')`. Every
push notification Drive sent for the rest of this build likely landed on
that frozen stub, which still returns HTTP 200 (Apps Script always does,
regardless of what the code does internally) -- so failures were invisible
from Drive's side, and the only symptom was "push notifications never seem
to fire," which really meant "they fire, but hit dead code." Manually
running `processChanges()` was masking this the whole time.

**Fixed** by running `clasp update-deployment <the deployment id
WEBHOOK_URL uses> --description "..."` to push current code onto that
existing deployment (same URL, new version -- no need to change
`WEBHOOK_URL` or re-register the channel). **Takeaway: after any change to
`doPost`, `processChanges`, or anything they call, redeploy** --
`clasp push` to HEAD is not enough on its own for anything reachable via
the live webhook.

## Watch channels lasted ~1 hour, not the 24h+ assumed -- daily renewal was far too infrequent

Fixing the stale deployment above still didn't get `doPost` firing
automatically. Turned out to be a second, unrelated problem: checking the
persisted `DRIVE_WATCH_CHANNEL_EXPIRATION` in Script Properties against
when it was granted showed Drive giving this account/resource only about
**one hour** of channel lifetime when `startWatch()` didn't request a
specific expiration -- confirmed twice (an expired channel, then a freshly
registered one, both ~1h). `RenewalTrigger.gs`'s original design assumed
something more like 24h+ and checked only once a day (with a 2-day
"buffer"), meaning the channel was guaranteed to already be dead for ~23
hours before the next renewal check even ran -- explaining why every
upload silently went nowhere until someone manually reran `startWatch()`.

**Fixed** two ways, so it's robust regardless of what Drive actually
grants: `WatchChannel.gs::startWatch()` now explicitly requests a 24h
expiration (Google may still cap it lower), and
`RenewalTrigger.gs::installRenewalTrigger()` now installs a 15-minute
trigger with a 25-minute buffer instead of daily/2-day -- safe even if
channels keep coming back at ~1h.

**After this fix, both of these need to be manually re-run once** (same
"editor UI, not `clasp run`" reasoning as everywhere else in this doc):
`installRenewalTrigger()` (to replace the old daily trigger -- it doesn't
update itself just because the code changed) and `startWatch()` (to
register a channel under the new expiration-requesting logic).

## Push notifications never reliably worked -- switched to polling (2026-07-27)

Even after fixing both confirmed bugs above (stale deployment, then channel
expiration/renewal cadence), `doPost` still didn't fire automatically on a
clean end-to-end retest. At that point, chasing this further stopped being
worth it relative to just using the fallback this project always planned
for (see the old `WEBHOOK_URL` comment history in `Config.gs`, and "Why not
a simple time-driven trigger?" below for why push was tried first).

**What's live now:** `ChangeProcessor.installPollingTrigger()` installs a
1-minute time-driven trigger calling `processChanges()` directly --
detection no longer depends on `doPost` firing at all. The push
infrastructure (`WatchChannel.gs`, `WebhookHandler.gs`,
`RenewalTrigger.gs`) is left running, not removed -- harmless, and if it
ever starts working the polling trigger just becomes redundant rather than
something that needs to be un-done.

**Not conclusively root-caused.** The original suspicion from before any
of this was built -- Drive push notifications sometimes require the
receiving domain to be verified for the associated Cloud project -- was
never ruled in or out with the same confidence as the deployment/expiration
bugs. Worth revisiting if someone wants push's lower latency later, but
polling is what this pipeline actually runs on for now.

## Why not a simple time-driven trigger?

Apps Script's easiest option for "run periodically" is a time-driven
trigger, but that's polling. Drive's `Changes.watch` gives a real push
notification (a webhook POST) instead, at the cost of more setup: it's
account-wide rather than folder-scoped, so filtering has to happen in code,
and the subscription needs periodic renewal. See the module docstring in
`WatchChannel.gs` for the full reasoning. **This was the reasoning for
trying push first, not a claim that polling doesn't work** -- see directly
above for why this project ended up on a polling trigger anyway.

## One-time manual deploy steps

1. Open this project in the Apps Script editor (`clasp` recommended once
   this project is pushed there — see `.clasp.json` in `.gitignore`, not
   committed).
2. **Deploy → New deployment → Web app.** Execute as: Me. Who has access:
   Anyone.
3. Copy the resulting `/exec` URL into `WEBHOOK_URL` in `Config.gs`.
4. Run `installPollingTrigger()` once **from the Apps Script editor UI**
   (select it in the function dropdown, click Run) -- this is what
   detection actually runs on right now (see "Push notifications never
   reliably worked" above); see "Running functions" below for why this has
   to be the editor and not `clasp run`.
5. Optional, best-effort (push isn't relied on, but doesn't hurt to have
   running too): `startWatch()` to register a push-notification channel,
   then `installRenewalTrigger()` to keep it alive.

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
