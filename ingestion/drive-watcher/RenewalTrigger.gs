/**
 * Drive watch channels expire, so the push-notification subscription needs
 * periodic renewal. This is bookkeeping for the *subscription*, not polling
 * for new files -- new-file detection stays entirely push-driven via
 * WebhookHandler.doPost.
 */

// Renew if the channel expires within this window. Confirmed 2026-07-27:
// Drive granted this account/resource only ~1 hour of channel lifetime by
// default (the original "2 days" buffer here was sized for an assumption
// of a much longer default -- e.g. 24h+ -- that turned out to be wrong,
// and combined with a daily trigger meant the channel was *always* dead
// for ~23 hours before the next renewal check even ran). WatchChannel.gs
// now explicitly requests a 24h expiration, but this buffer/cadence is
// sized to stay safe even if Drive keeps granting only ~1h regardless.
var RENEWAL_BUFFER_MS = 25 * 60 * 1000; // 25 minutes

/**
 * One-time manual setup: run this once (from the Apps Script editor -- see
 * ingestion/drive-watcher/README.md's "Running functions" note on why
 * clasp run doesn't work here) to install the renewal check. Safe to
 * re-run: clears any existing trigger for renewWatchIfNeeded first so
 * repeated calls don't stack up duplicate triggers -- re-run this after
 * changing the trigger cadence below, since installing doesn't happen
 * automatically on push.
 */
function installRenewalTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'renewWatchIfNeeded') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 15 minutes: comfortably more frequent than RENEWAL_BUFFER_MS above,
  // so even the worst-case gap between checks can't let the channel
  // actually expire before a renewal catches it.
  ScriptApp.newTrigger('renewWatchIfNeeded')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('Installed 15-minute renewal trigger for renewWatchIfNeeded.');
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
