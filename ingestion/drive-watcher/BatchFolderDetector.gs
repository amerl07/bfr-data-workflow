/**
 * Filters the account-wide Drive change feed down to events relevant to
 * WATCHED_FOLDER_ID, and distinguishes the event shapes we actually care
 * about.
 *
 * These are genuinely different cases and should not be collapsed into one:
 *   1. A new batch folder (e.g. RW_v3_VEL_20260709_YM/) created directly
 *      under WATCHED_FOLDER_ID.
 *   2. A new post.zip file added inside an *existing* batch folder (a
 *      grandchild of WATCHED_FOLDER_ID) -- the organized case, per the
 *      Proposal Outline §4.1 folder-per-batch convention.
 *   3. A new post.zip file added directly under WATCHED_FOLDER_ID, with no
 *      batch folder at all. Not the documented convention, but supported
 *      deliberately -- in practice not everyone will always organize
 *      uploads into batch folders, and a post.zip dropped loose shouldn't
 *      silently go unprocessed. When this happens, `source_drive_folder`
 *      downstream just ends up pointing at the watched root itself rather
 *      than a meaningful batch folder -- that's an accepted tradeoff of
 *      allowing this case, not a bug.
 *
 * Current scope (see CONTRIBUTING.md): post_<job_name>.zip is the only file
 * type expected to land here (in a batch folder or directly under the
 * root). Nothing else is currently supported or expected -- isNewPostZipFile
 * validates the filename against that convention
 * (post_zip_file_format_spec.md §0); anything that doesn't match returns
 * false here and is simply not routed anywhere by ChangeProcessor, rather
 * than being treated as a different file type to route elsewhere.
 *
 * Folder nesting is assumed to be at most the 2-level hierarchy documented
 * in the Proposal Outline §4.1 (root -> batch folder -> file) -- these
 * functions don't walk arbitrarily deep.
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
 * True when `file` is a post.zip either inside an existing batch folder
 * (case 2 above) or directly under WATCHED_FOLDER_ID with no batch folder
 * (case 3 above) -- its name matches `post_<job_name>.zip`
 * (post_zip_file_format_spec.md §0) and its parent is either
 * WATCHED_FOLDER_ID itself or a folder that's a direct child of it.
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
    return parentFolderId === WATCHED_FOLDER_ID || isWithinWatchedFolder(parentFolderId);
  });
}
