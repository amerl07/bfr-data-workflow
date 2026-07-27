/**
 * Drive watch channels expire, so the push-notification subscription needs
 * periodic renewal. This is bookkeeping for the *subscription*, not polling
 * for new files -- new-file detection stays entirely push-driven via
 * WebhookHandler.doPost.
 */

// Renew if the channel expires within this window. Deliberately generous
// relative to the daily trigger cadence below, so a trigger run that's a
// bit late (or a single missed run) still catches it before the channel
// actually expires.
var RENEWAL_BUFFER_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

/**
 * One-time manual setup: run this once (from the Apps Script editor -- see
 * ingestion/drive-watcher/README.md's "Running functions" note on why
 * clasp run doesn't work here) to install the daily renewal check.
 * Safe to re-run: clears any existing trigger for renewWatchIfNeeded first
 * so repeated calls don't stack up duplicate triggers.
 */
function installRenewalTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'renewWatchIfNeeded') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('renewWatchIfNeeded')
    .timeBased()
    .everyDays(1)
    .create();

  Logger.log('Installed daily renewal trigger for renewWatchIfNeeded.');
}

/**
 * Trigger target for the installed time-based trigger. Renews the watch
 * channel if it's within RENEWAL_BUFFER_MS of its Google-assigned
 * expiration (see WatchChannel.gs::startWatch); otherwise a no-op.
 */
function renewWatchIfNeeded() {
  var props = PropertiesService.getScriptProperties();
  var expiration = props.getProperty(PROP_CHANNEL_EXPIRATION);
  var expirationMs = expiration ? Number(expiration) : 0;
  var dueForRenewal = !expirationMs || Date.now() > expirationMs - RENEWAL_BUFFER_MS;

  if (!dueForRenewal) {
    Logger.log('Watch channel still valid until %s; no renewal needed.', new Date(expirationMs));
    return;
  }

  Logger.log('Renewing Drive watch channel.');
  try {
    stopWatch();
  } catch (err) {
    // The old channel may already be expired/invalid server-side by this
    // point -- that's fine, startWatch() below replaces it regardless.
    Logger.log('stopWatch() failed during renewal (continuing anyway): %s', err);
  }
  startWatch();
}
