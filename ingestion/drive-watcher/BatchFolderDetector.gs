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
 *   4. A new *unzipped* post folder -- a folder (not a .zip file) named
 *      `post_<job_name>` (post_zip_file_format_spec.md §0's naming, minus
 *      the .zip), containing the same scene images + force_reports.txt a
 *      post.zip would. Supported so that images inside it are already
 *      individually addressable Drive files -- no unzip step needed, and
 *      the "link only" image-handling decision (CONTRIBUTING.md §4) works
 *      cleanly without needing to re-upload anything. Same
 *      batch-folder-or-not flexibility as case 2/3.
 *
 * A folder this project itself creates (ingestion/queue_consumer's
 * "<job_name>_extracted" folders, uploaded alongside a processed post.zip
 * so its images become individually link-able too) is deliberately named
 * to NOT start with "post_" and lands one level deeper than a batch
 * folder, so it can't be mistaken for case 1 or case 4 and re-trigger
 * processing of its own output.
 *
 * Current scope (see CONTRIBUTING.md): a post job, either as a
 * `post_<job_name>.zip` or an already-unzipped `post_<job_name>` folder, is
 * the only thing expected to land here (in a batch folder or directly
 * under the root). Nothing else is currently supported or expected --
 * isNewPostZipFile/isNewPostFolder validate against those conventions
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
var POST_FOLDER_NAME_PATTERN = /^post_.+$/;

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
 * (case 1 above) -- a new batch folder. Explicitly excludes anything
 * matching POST_FOLDER_NAME_PATTERN so a case-4 unzipped post folder
 * dropped with no batch folder isn't misdetected as case 1 instead.
 * @param {Object} file Drive file resource with at least mimeType, parents.
 */
function isNewBatchFolder(file) {
  if (!file || file.mimeType !== FOLDER_MIME_TYPE) {
    return false;
  }
  if (POST_FOLDER_NAME_PATTERN.test(file.name || '')) {
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

/**
 * True when `file` is an already-unzipped post folder (case 4 above) --
 * its name matches `post_<job_name>` (no .zip) and its parent is either
 * WATCHED_FOLDER_ID itself or a folder that's a direct child of it. Same
 * shape as isNewPostZipFile, just for the folder case.
 * @param {Object} file Drive file resource with at least name, mimeType,
 *     parents.
 */
function isNewPostFolder(file) {
  if (!file || file.mimeType !== FOLDER_MIME_TYPE) {
    return false;
  }
  if (!POST_FOLDER_NAME_PATTERN.test(file.name || '')) {
    return false;
  }
  var parents = file.parents || [];
  return parents.some(function (parentFolderId) {
    return parentFolderId === WATCHED_FOLDER_ID || isWithinWatchedFolder(parentFolderId);
  });
}
