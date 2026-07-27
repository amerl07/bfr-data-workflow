/**
 * Pulls the actual change list from Drive once WebhookHandler has confirmed
 * a notification is worth acting on, and advances the stored page token.
 */

var CHANGES_LIST_FIELDS =
  'changes(fileId,removed,file(id,name,mimeType,parents)),newStartPageToken,nextPageToken';

/**
 * One-time manual setup (editor UI, not clasp run -- see README's "Running
 * functions" note): installs a polling fallback trigger that calls
 * processChanges() directly every 5 minutes, regardless of whether Drive's
 * push notifications are reaching doPost.
 *
 * Not the originally intended design (see WatchChannel.gs's module
 * docstring for why push was preferred) -- but push has proven unreliable
 * for this project's setup even after fixing two confirmed real bugs (a
 * stale deployment, and a too-infrequent channel-renewal cadence). This was
 * always the documented fallback (see Config.gs's WEBHOOK_URL comment),
 * now actually installed. The push-notification infrastructure
 * (WatchChannel.gs, WebhookHandler.gs, RenewalTrigger.gs) is left running,
 * not removed -- if it ever starts working reliably, detection just gets
 * faster; this polling trigger keeps things working either way. Safe to
 * re-run: clears any existing trigger for processChanges first.
 */
function installPollingTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'processChanges') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processChanges')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Installed 5-minute polling trigger for processChanges().');
}

/**
 * Fetches changes since the last recorded page token, routes each relevant
 * one (new batch folder / new post.zip -- see BatchFolderDetector.gs) to
 * Dispatcher.handOffNewFile, and advances PROP_PAGE_TOKEN so the next call
 * only sees what's new since this run. Safe to call even when nothing has
 * actually changed -- Drive just returns an empty changes list.
 */
function processChanges() {
  var props = PropertiesService.getScriptProperties();
  var pageToken = props.getProperty(PROP_PAGE_TOKEN);

  if (!pageToken) {
    throw new Error('No page token on record -- run startWatch() before processChanges().');
  }

  while (pageToken) {
    var response = Drive.Changes.list(pageToken, { fields: CHANGES_LIST_FIELDS });

    (response.changes || []).forEach(handleChange);

    if (response.newStartPageToken) {
      props.setProperty(PROP_PAGE_TOKEN, response.newStartPageToken);
    }
    pageToken = response.nextPageToken || null;
  }
}

/**
 * @param {Object} change A single entry from Drive.Changes.list's response.
 */
function handleChange(change) {
  if (change.removed || !change.file) {
    return; // Deletions, or files we no longer have access to -- nothing to ingest.
  }
  var file = change.file;

  if (isNewBatchFolder(file)) {
    Logger.log('New batch folder detected: %s (%s)', file.name, file.id);
    // Nothing to hand off yet -- a batch folder on its own has no post.zip
    // to parse. Its post.zip(s) arrive as separate change events, handled
    // by the isNewPostZipFile branch below (possibly in a later
    // processChanges() call).
    return;
  }

  if (isNewPostZipFile(file)) {
    Logger.log('New post.zip detected: %s (%s)', file.name, file.id);
    handOffNewFile(file);
    return;
  }

  if (isNewPostFolder(file)) {
    Logger.log('New unzipped post folder detected: %s (%s)', file.name, file.id);
    handOffNewFile(file);
    return;
  }

  // Anything else is either outside WATCHED_FOLDER_ID entirely, or an
  // unexpected file inside a batch folder (see CONTRIBUTING.md "Current
  // scope"). Not routed anywhere -- this pipeline only ingests post jobs
  // (zipped or unzipped) right now.
}
