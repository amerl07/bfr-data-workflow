/**
 * Configuration for the Drive watcher.
 *
 * TODO: fill in once the batch-folder ingestion point is finalized (Proposal
 * Outline §4.1). This should point at the parent Drive folder under which
 * per-batch folders (RW_v3_VEL_20260709_YM/, etc.) get created.
 */

// Drive folder that batch folders are dropped into.
var WATCHED_FOLDER_ID = '1XhrMoU9ermfWZocgzl05-cHdmZexGKih';

// Script Properties keys used to persist push-notification channel state
// across executions (Apps Script has no durable memory between triggers).
var PROP_CHANNEL_ID = 'DRIVE_WATCH_CHANNEL_ID';
var PROP_RESOURCE_ID = 'DRIVE_WATCH_RESOURCE_ID';
var PROP_PAGE_TOKEN = 'DRIVE_WATCH_PAGE_TOKEN';
var PROP_CHANNEL_EXPIRATION = 'DRIVE_WATCH_CHANNEL_EXPIRATION';

// Shared secret appended as a query param on the watch channel's address
// (see WatchChannel.gs::startWatch). Apps Script's doPost(e) cannot read
// the X-Goog-Channel-ID / X-Goog-Channel-Token headers Drive sends on push
// notifications -- there is no e.headers -- so header-based validation
// (as originally sketched here) isn't possible. A query-string token is
// the workaround: query params ARE readable via e.parameter in doPost.
var PROP_WEBHOOK_TOKEN = 'DRIVE_WATCH_WEBHOOK_TOKEN';

// Script Properties key for the processing-queue spreadsheet (see
// Dispatcher.gs) that detected post.zip files get appended to as rows for
// a separate Python job to pick up. Self-provisioned on first use -- see
// Dispatcher.gs::getOrCreateQueueSheet -- rather than a manual TODO here.
var PROP_QUEUE_SPREADSHEET_ID = 'DRIVE_WATCH_QUEUE_SPREADSHEET_ID';

// Drive folder (a subfolder of WATCHED_FOLDER_ID) that generated
// spreadsheets -- the processing queue, and any future ones -- get filed
// into. See Dispatcher.gs::moveToGeneratedSheetsFolder.
var GENERATED_SHEETS_FOLDER_ID = '1QCln4vmn7F-QdfQjA5dXi092Vydts2z_';

/**
 * The deployed Web App's /exec URL. Drive push notifications are POSTed to
 * this address (with a ?token=... query param appended by
 * WatchChannel.gs::startWatch -- see PROP_WEBHOOK_TOKEN above).
 *
 * IMPORTANT: this is a specific deployment, not HEAD -- `clasp push` alone
 * does NOT update what's served here. After changing doPost, processChanges,
 * or anything they call, run `clasp update-deployment <this deployment's
 * id>` too, or the live endpoint keeps serving old code silently (Apps
 * Script web apps always return HTTP 200 regardless of what the code
 * does, so a stale deployment fails invisibly). See
 * ingestion/drive-watcher/README.md's "Deployments are frozen snapshots"
 * section -- this exact mistake cost real debugging time (2026-07-27).
 *
 * Status (2026-07-26): push notifications never reliably reached doPost
 * for this project's setup, even after fixing the stale-deployment bug
 * above and a separate channel-expiration/renewal-cadence bug (see
 * README's "Watch channels lasted ~1 hour" section). Root cause not fully
 * confirmed -- domain verification (the original concern this comment used
 * to flag) remains a plausible explanation, but wasn't isolated as
 * conclusively as the other two bugs were. Falling back to the
 * originally-planned polling trigger: see
 * ChangeProcessor.gs::installPollingTrigger(), which calls
 * processChanges() directly every 5 minutes. Push infrastructure
 * (WatchChannel.gs, WebhookHandler.gs, RenewalTrigger.gs) is left in
 * place and still running, not removed -- if it starts working, detection
 * just gets faster; the polling trigger keeps things working either way.
 */
var WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbw-IqHHJrdFuvnVHyxHgn7lGp2U1q2_v5k5T1Ysbd0CcMG5kteQeL07uzSvzmWGLV9T/exec';
