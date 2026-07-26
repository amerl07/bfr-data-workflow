/**
 * Filters the account-wide Drive change feed down to events relevant to
 * WATCHED_FOLDER_ID, and distinguishes the two event shapes we actually
 * care about.
 *
 * These are genuinely different cases and should not be collapsed into one:
 *   1. A new batch folder (e.g. RW_v3_VEL_20260709_YM/) created directly
 *      under WATCHED_FOLDER_ID.
 *   2. A new post.zip file added inside an *existing* batch folder (a
 *      grandchild of WATCHED_FOLDER_ID).
 */

/**
 * TODO: implement.
 * - Walk the file's parents chain (file.parents from the Drive API) and
 *   check whether WATCHED_FOLDER_ID appears at the expected depth (direct
 *   parent, for case 2 above) or is itself the parent (case 1).
 * @param {string} fileId
 */
function isWithinWatchedFolder(fileId) {
  throw new Error('TODO: not implemented -- see BatchFolderDetector.gs');
}

/**
 * TODO: implement. True when `file` is a new folder created directly under
 * WATCHED_FOLDER_ID (case 1 above).
 * @param {Object} file
 */
function isNewBatchFolder(file) {
  throw new Error('TODO: not implemented -- see BatchFolderDetector.gs');
}

/**
 * TODO: implement. True when `file` is a new post.zip created inside an
 * existing batch folder (case 2 above).
 * @param {Object} file
 */
function isNewPostZipFile(file) {
  throw new Error('TODO: not implemented -- see BatchFolderDetector.gs');
}
