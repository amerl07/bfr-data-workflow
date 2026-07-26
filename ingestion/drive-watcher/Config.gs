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

/**
 * TODO: after deploying this project as a Web App (Deploy > New deployment
 * > Web app), paste the resulting /exec URL here. Drive push notifications
 * are POSTed to this address.
 *
 * Note: Drive's push notification API requires the receiving domain to be
 * verified for the associated Cloud project in some configurations. In
 * practice script.google.com deployments have worked for teams without
 * extra verification, but this hasn't been confirmed for this project's
 * Cloud/Workspace setup -- verify this works end-to-end before relying on
 * it, and fall back to a short-interval time-driven trigger calling
 * listChanges() directly if push notifications turn out to be unreliable
 * here.
 */
var WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbw-IqHHJrdFuvnVHyxHgn7lGp2U1q2_v5k5T1Ysbd0CcMG5kteQeL07uzSvzmWGLV9T/exec';
