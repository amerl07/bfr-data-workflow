/**
 * Pulls the actual change list from Drive once WebhookHandler has confirmed
 * a notification is worth acting on, and advances the stored page token.
 */

/**
 * TODO: implement.
 * - Read PROP_PAGE_TOKEN from Script Properties.
 * - Drive.Changes.list({ pageToken: ... }) to fetch changes since last run.
 * - For each changed file, delegate to BatchFolderDetector to decide
 *   whether it's relevant (inside WATCHED_FOLDER_ID) and what kind of event
 *   it represents (new batch folder vs. new post.zip inside an existing
 *   batch folder).
 * - For relevant files, delegate to Dispatcher.handOffNewFile(file).
 * - Persist the response's newStartPageToken back to PROP_PAGE_TOKEN so the
 *   next run picks up where this one left off.
 */
function processChanges() {
  throw new Error('TODO: not implemented -- see ChangeProcessor.gs');
}
