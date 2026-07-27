/**
 * Lifecycle management for the Drive push-notification channel.
 *
 * Drive API v3 has no "notify me when a file is added to folder X"
 * primitive: Files.watch only watches an existing file/folder's own
 * metadata, not additions of children under it. Changes.watch watches the
 * whole account-wide change feed for whoever authorized this script. So
 * "folder-scoped" behavior is achieved by watching everything and filtering
 * in code (see BatchFolderDetector.gs) -- this is still push-based (no
 * polling for new files), it's just not natively folder-scoped.
 */

/**
 * Starts (or restarts) the account-wide change-feed watch and persists the
 * resulting channel state so ChangeProcessor and RenewalTrigger can use it
 * across separate executions.
 *
 * Run this manually from the Apps Script editor as part of one-time setup
 * (see ingestion/drive-watcher/README.md), and again from
 * RenewalTrigger.renewWatchIfNeeded() before the channel expires.
 */
function startWatch() {
  var props = PropertiesService.getScriptProperties();

  // Reuse an existing webhook token across restarts so a renewal doesn't
  // silently invalidate calls already in flight. See the PROP_WEBHOOK_TOKEN
  // comment in Config.gs for why this exists instead of header validation.
  var webhookToken = props.getProperty(PROP_WEBHOOK_TOKEN);
  if (!webhookToken) {
    webhookToken = Utilities.getUuid();
    props.setProperty(PROP_WEBHOOK_TOKEN, webhookToken);
  }
  var separator = WEBHOOK_URL.indexOf('?') === -1 ? '?' : '&';
  var address = WEBHOOK_URL + separator + 'token=' + encodeURIComponent(webhookToken);

  var startPageToken = Drive.Changes.getStartPageToken().startPageToken;

  // Explicitly request a long expiration -- confirmed 2026-07-27 that
  // Drive's default (when this field is omitted) is only ~1 hour for this
  // account/resource, far shorter than assumed when RenewalTrigger's
  // cadence was first set. Google may cap this request lower regardless;
  // channel.expiration below is whatever was actually granted, which is
  // what gets trusted/stored either way.
  var requestedExpirationMs = String(Date.now() + 24 * 60 * 60 * 1000); // 24h

  var channel = Drive.Changes.watch(
    {
      id: Utilities.getUuid(),
      type: 'web_hook',
      address: address,
      expiration: requestedExpirationMs
    },
    startPageToken
  );

  // channel.expiration is whatever Google actually assigned (a Unix ms
  // timestamp, as a string) -- trusted as-is, whether or not it matches
  // the requested value above.
  props.setProperty(PROP_CHANNEL_ID, channel.id);
  props.setProperty(PROP_RESOURCE_ID, channel.resourceId);
  props.setProperty(PROP_PAGE_TOKEN, startPageToken);
  props.setProperty(PROP_CHANNEL_EXPIRATION, channel.expiration || '');

  Logger.log(
    'Started Drive watch channel %s (resourceId=%s), expires %s',
    channel.id, channel.resourceId, channel.expiration
  );

  return channel;
}

/**
 * Stops the currently active watch channel and clears its persisted state
 * (except the webhook token, which is reused across restarts).
 */
function stopWatch() {
  var props = PropertiesService.getScriptProperties();
  var channelId = props.getProperty(PROP_CHANNEL_ID);
  var resourceId = props.getProperty(PROP_RESOURCE_ID);

  if (!channelId || !resourceId) {
    Logger.log('No active watch channel found in Script Properties; nothing to stop.');
    return;
  }

  Drive.Channels.stop({ id: channelId, resourceId: resourceId });

  props.deleteProperty(PROP_CHANNEL_ID);
  props.deleteProperty(PROP_RESOURCE_ID);
  props.deleteProperty(PROP_PAGE_TOKEN);
  props.deleteProperty(PROP_CHANNEL_EXPIRATION);

  Logger.log('Stopped Drive watch channel %s', channelId);
}

/**
 * Returns whether the persisted watch channel is still within its
 * expiration window. Used by RenewalTrigger.renewWatchIfNeeded() to decide
 * whether a renewal is due.
 */
function isWatchActive() {
  var props = PropertiesService.getScriptProperties();
  var channelId = props.getProperty(PROP_CHANNEL_ID);
  var expiration = props.getProperty(PROP_CHANNEL_EXPIRATION);

  if (!channelId || !expiration) {
    return false;
  }

  var expirationMs = Number(expiration);
  if (!expirationMs) {
    return false;
  }

  return Date.now() < expirationMs;
}
