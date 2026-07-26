# drive-watcher

Google Apps Script project that watches the shared Drive folder batch
outputs get dropped into, and fires (push-based, not polling) when a new
batch folder or `post.zip` shows up. See file-level TODOs for what's still
unimplemented -- this is scaffolding, none of the logic runs yet.

## Files

- `appsscript.json` — project manifest (Drive v3 advanced service, web app
  config).
- `Config.gs` — `WATCHED_FOLDER_ID`, `WEBHOOK_URL`, and the Script Properties
  keys used to persist watch-channel state across executions.
- `WatchChannel.gs` — start/stop/check the Drive push-notification channel.
- `WebhookHandler.gs` — `doPost`, the entry point Drive calls.
- `ChangeProcessor.gs` — pulls the actual change list once notified.
- `BatchFolderDetector.gs` — filters the account-wide change feed down to
  events inside `WATCHED_FOLDER_ID`.
- `Dispatcher.gs` — hands a detected file off to the next stage (mechanism
  not yet decided — see TODO in the file).
- `RenewalTrigger.gs` — keeps the watch channel alive (channels expire; this
  is subscription bookkeeping, not file polling).

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
4. Run `startWatch()` once from the editor to register the push-notification
   channel.
5. Run `installRenewalTrigger()` once to install the daily channel-renewal
   check.

## Known open risk

Drive push notifications may require the receiving domain to be verified
for the associated Cloud project in some configurations. `script.google.com`
deployments have worked for other teams without extra verification, but this
hasn't been confirmed for this project's setup — verify end-to-end after
step 4 above (create a test file in the watched folder and confirm
`doPost` fires) before relying on this in production. If it doesn't work,
fall back to a short-interval time-driven trigger calling
`ChangeProcessor.processChanges()` directly.
