/**
 * Drive watch channels expire, so the push-notification subscription needs
 * periodic renewal. This is bookkeeping for the *subscription*, not polling
 * for new files -- new-file detection stays entirely push-driven via
 * WebhookHandler.doPost.
 */

/**
 * One-time manual setup: run this once from the Apps Script editor to
 * install the daily renewal check.
 *
 * TODO: implement.
 * - ScriptApp.newTrigger('renewWatchIfNeeded').timeBased().everyDays(1)
 *   .create();
 * - Confirm the actual Drive channel expiration ceiling against current API
 *   docs before settling on a daily cadence -- it may need to be more
 *   frequent.
 */
function installRenewalTrigger() {
  throw new Error('TODO: not implemented -- see RenewalTrigger.gs');
}

/**
 * Trigger target for the installed time-based trigger.
 *
 * TODO: implement.
 * - Check PROP_CHANNEL_EXPIRATION (via isWatchActive() in WatchChannel.gs)
 *   against now-plus-buffer.
 * - If close to expiring, stopWatch() then startWatch() again.
 */
function renewWatchIfNeeded() {
  throw new Error('TODO: not implemented -- see RenewalTrigger.gs');
}
