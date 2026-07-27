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
 * supported or expected -- isNewPostZipFile validates the filename against
 * that convention (post_zip_file_format_spec.md §0); anything in the
 * folder that doesn't match returns false here and is simply not routed
 * anywhere by ChangeProcessor, rather than being treated as a different
 * file type to route elsewhere.
 *
 * All of this assumes the fixed 2-level hierarchy documented in the
 * Proposal Outline §4.1 (root -> batch folder -> file) -- these functions
 * don't walk arbitrarily deep.
 */

var FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
var POST_ZIP_NAME_PATTERN = /^post_.+\.zip$/;

/**
 * True if `fileId` is either a direct child of WATCHED_FOLDER_ID, or a
 * grandchild of it (i.e. its parent's parent is WATCHED_FOLDER_ID).
 * @param {string} fileId
 */
function isWithinWatchedFolder(fileId) {
  var file = Drive.Files.get(fileId, { fields: 'id, parents' });
  var parents = file.parents || [];
  if (parents.indexOf(WATCHED_FOLDER_ID) !== -1) {
    return true;
  }
  return parents.some(function (parentId) {
    var parent = Drive.Files.get(parentId, { fields: 'id, parents' });
    return (parent.parents || []).indexOf(WATCHED_FOLDER_ID) !== -1;
  });
}

/**
 * True when `file` is a folder created directly under WATCHED_FOLDER_ID
 * (case 1 above) -- a new batch folder.
 * @param {Object} file Drive file resource with at least mimeType, parents.
 */
function isNewBatchFolder(file) {
  if (!file || file.mimeType !== FOLDER_MIME_TYPE) {
    return false;
  }
  return (file.parents || []).indexOf(WATCHED_FOLDER_ID) !== -1;
}

/**
 * True when `file` is a post.zip created inside an existing batch folder
 * (case 2 above) -- its name matches `post_<job_name>.zip`
 * (post_zip_file_format_spec.md §0) and its parent folder is itself a
 * direct child of WATCHED_FOLDER_ID.
 * @param {Object} file Drive file resource with at least name, mimeType,
 *     parents.
 */
function isNewPostZipFile(file) {
  if (!file || file.mimeType === FOLDER_MIME_TYPE) {
    return false;
  }
  if (!POST_ZIP_NAME_PATTERN.test(file.name || '')) {
    return false;
  }
  var parents = file.parents || [];
  return parents.some(function (parentFolderId) {
    return isWithinWatchedFolder(parentFolderId);
  });
}
