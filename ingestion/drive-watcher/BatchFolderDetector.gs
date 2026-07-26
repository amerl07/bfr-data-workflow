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
 *
 * Current scope (see CONTRIBUTING.md): post_<job_name>.zip is the only file
 * type expected to land inside a batch folder. Nothing else is currently
 * supported or expected -- isNewPostZipFile should validate the filename
 * against that convention (post_zip_file_format_spec.md §0), and anything
 * in the folder that doesn't match is anomalous for now (log/flag it),
 * not a different file type to route elsewhere.
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
 * existing batch folder (case 2 above) -- i.e. its name matches
 * `post_<job_name>.zip` per post_zip_file_format_spec.md §0. Per current
 * scope, this is the only file type ever expected here; a file inside a
 * batch folder that doesn't match should return false and get logged
 * upstream as unexpected, not silently accepted.
 * @param {Object} file
 */
function isNewPostZipFile(file) {
  throw new Error('TODO: not implemented -- see BatchFolderDetector.gs');
}
