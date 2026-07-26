/**
 * Web app entry point. Once this project is deployed as a Web App and its
 * /exec URL is registered as WEBHOOK_URL (Config.gs) and passed to
 * Drive.Changes.watch (WatchChannel.gs), Drive POSTs push notifications
 * here whenever anything changes in the account's change feed.
 *
 * doPost is an Apps Script reserved function name -- Apps Script calls it
 * automatically for incoming POST requests to the deployed web app; it is
 * not called directly from elsewhere in this project.
 *
 * TODO: implement.
 * - Validate the X-Goog-Channel-ID header against the channel id persisted
 *   by startWatch(); ignore/reject requests that don't match (stale or
 *   spoofed channel).
 * - If X-Goog-Resource-State is 'sync' (the initial handshake Drive sends
 *   when a channel is created), just acknowledge -- there's no change to
 *   process yet.
 * - Otherwise, delegate to ChangeProcessor.processChanges().
 * - Design constraint to keep in mind when implementing: Drive expects a
 *   fast 2xx response from this endpoint. Any nontrivial work (unzipping,
 *   parsing) should be handed off rather than done inline here -- exact
 *   hand-off mechanism is Dispatcher.gs's open question.
 *
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  throw new Error('TODO: not implemented -- see WebhookHandler.gs');
}
