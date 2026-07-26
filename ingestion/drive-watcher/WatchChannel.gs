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
 * TODO: implement.
 * - Drive.Changes.getStartPageToken() to get a baseline pageToken.
 * - Drive.Changes.watch({ id: Utilities.getUuid(), type: 'web_hook',
 *   address: WEBHOOK_URL }, startPageToken) to register the channel.
 * - Persist channelId, resourceId, pageToken, and expiration into Script
 *   Properties via the PROP_* keys defined in Config.gs.
 */
function startWatch() {
  throw new Error('TODO: not implemented -- see WatchChannel.gs');
}

/**
 * Stops the currently active watch channel and clears its persisted state.
 *
 * TODO: implement.
 * - Drive.Channels.stop({ id, resourceId }) using the stored PROP_* values.
 * - Clear the PROP_* Script Properties afterward.
 */
function stopWatch() {
  throw new Error('TODO: not implemented -- see WatchChannel.gs');
}

/**
 * Returns whether the persisted watch channel is still within its
 * expiration window.
 *
 * TODO: implement.
 * - Compare PROP_CHANNEL_EXPIRATION against Date.now().
 * - Confirm the actual Drive channel expiration ceiling against current API
 *   docs before RenewalTrigger.gs hardcodes a renewal cadence around this.
 */
function isWatchActive() {
  throw new Error('TODO: not implemented -- see WatchChannel.gs');
}
