# drive-watcher

Google Apps Script project that watches the shared Drive folder batch
outputs get dropped into, and fires (push-based, not polling) when a new
batch folder or `post.zip` shows up.

**Status:** `WatchChannel.gs` and `WebhookHandler.gs` are implemented.
`ChangeProcessor.gs`, `BatchFolderDetector.gs`, `Dispatcher.gs`, and
`RenewalTrigger.gs` are still stubs -- see file-level TODOs.

## Files

- `appsscript.json` — project manifest (Drive v3 advanced service, web app
  config).
- `Config.gs` — `WATCHED_FOLDER_ID`, `WEBHOOK_URL`, and the Script Properties
  keys used to persist watch-channel state across executions.
- `WatchChannel.gs` — start/stop/check the Drive push-notification channel.
  **Implemented.**
- `WebhookHandler.gs` — `doPost`, the entry point Drive calls. **Implemented**
  (see "Header limitation" below for a real constraint this works around).
- `ChangeProcessor.gs` — pulls the actual change list once notified. Stub.
- `BatchFolderDetector.gs` — filters the account-wide change feed down to
  events inside `WATCHED_FOLDER_ID`. Stub.
- `Dispatcher.gs` — hands a detected file off to the next stage (mechanism
  not yet decided — see TODO in the file). Stub.
- `RenewalTrigger.gs` — keeps the watch channel alive (channels expire; this
  is subscription bookkeeping, not file polling). Stub.

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
