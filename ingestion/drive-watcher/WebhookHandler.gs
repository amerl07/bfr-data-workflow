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
 * Known platform limitation this implementation works around: Drive push
 * notifications carry their metadata (X-Goog-Resource-State,
 * X-Goog-Channel-ID, X-Goog-Channel-Token, etc.) as HTTP headers, but Apps
 * Script's doPost(e) event object has no way to read arbitrary request
 * headers -- there is no e.headers. That rules out header-based channel
 * validation and rules out distinguishing the initial 'sync' handshake
 * from a real change notification. Two consequences, both handled below:
 *   - Validation uses a shared-secret query parameter instead (readable
 *     via e.parameter, see WatchChannel.gs::startWatch and
 *     PROP_WEBHOOK_TOKEN in Config.gs).
 *   - Every validated call (including the initial 'sync' ping) just
 *     triggers processChanges(); relying on the persisted page token means
 *     a no-op check (nothing new since last time) is harmless, so not
 *     being able to tell 'sync' apart from a real change doesn't matter.
 *
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var expectedToken = props.getProperty(PROP_WEBHOOK_TOKEN);
  var providedToken = e && e.parameter ? e.parameter.token : null;

  if (!expectedToken || providedToken !== expectedToken) {
    Logger.log('Rejected webhook call: missing or invalid token.');
    // Apps Script web apps always respond with HTTP 200 regardless of the
    // content returned here -- there's no way to send a non-200 status
    // from doPost. This body is informational only; skipping processChanges()
    // below is the actual rejection.
    return ContentService.createTextOutput('forbidden');
  }

  // processChanges() only lists changes and hands relevant ones off (see
  // Dispatcher.gs) -- it doesn't itself unzip or parse anything, so it's
  // light enough to run inline here despite Drive expecting a fast
  // response. Swallow failures rather than let them propagate: an
  // uncaught error would still return 200 from Apps Script's perspective,
  // but logging it beats losing the failure silently.
  try {
    processChanges();
  } catch (err) {
    Logger.log('processChanges() failed: %s', err);
  }

  return ContentService.createTextOutput('ok');
}
