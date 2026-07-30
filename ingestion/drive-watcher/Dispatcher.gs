/**
 * Hands a detected, relevant post.zip file off to the Python parsing side.
 *
 * Mechanism (decided, see CONTRIBUTING.md / ingestion/parsers/): a Google
 * Sheet processing queue. This file appends a row per detection; a
 * separate, not-yet-built Python job reads new ("pending") rows on its own
 * schedule and does the actual unzip/parse/data-results.csv work. This
 * queue is intentionally decoupled from ChangeProcessor's Drive change
 * feed -- the Python side never touches Drive.Changes directly.
 */

var QUEUE_SHEET_NAME = 'Queue';
var QUEUE_HEADERS = ['detected_at', 'file_id', 'file_name', 'batch_folder_id', 'batch_folder_name', 'status'];

/**
 * Appends a row to the processing queue for `file` (a post.zip Drive file
 * resource -- see BatchFolderDetector.isNewPostZipFile). `file`'s parent
 * may be a real batch folder, or WATCHED_FOLDER_ID itself if the post.zip
 * was dropped with no batch folder (BatchFolderDetector's case 3) -- in
 * that latter case batch_folder_id/batch_folder_name are left blank
 * (rather than the watched root's own name, which downstream consumers
 * would otherwise wrongly try to parse as a batch folder name).
 * @param {Object} file
 */
function handOffNewFile(file) {
  var sheet = getOrCreateQueueSheet();

  if (isAlreadyQueued(sheet, file.id)) {
    // Confirmed happening in practice (2026-07-29): the same file_id
    // showed up in two separate Drive.Changes.list responses about 6
    // minutes apart, most likely a metadata-only touch (e.g. a permission
    // grant propagating) re-emitting a change event for a file whose
    // content didn't actually change. Without this check, every such
    // event became its own queue row and the Python consumer would
    // re-download/re-extract/re-upload the same job more than once.
    Logger.log('Skipping %s (%s) -- already has a queue row.', file.name, file.id);
    return;
  }

  var parentId = (file.parents || [])[0] || '';
  var hasBatchFolder = parentId && parentId !== WATCHED_FOLDER_ID;
  var batchFolderId = hasBatchFolder ? parentId : '';
  var batchFolderName = hasBatchFolder ? DriveApp.getFolderById(parentId).getName() : '';

  // Utilities.formatDate to a plain string, not a raw Date object -- a
  // Date passed directly into appendRow's array has been observed to
  // corrupt the rest of the row (every column ends up holding the same
  // date serial value instead of the intended distinct values).
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  sheet.appendRow([timestamp, file.id, file.name, batchFolderId, batchFolderName, 'pending']);

  Logger.log('Queued %s for processing (batch folder: %s).', file.name, batchFolderName || '(none)');
}

/**
 * True if `fileId` already has a row in the queue, regardless of its
 * status -- checked by file_id (column B) so an already-queued file is
 * skipped whether it's still "pending" or already "processing"/"done"/
 * "blocked"/"error" from a previous detection of the same file.
 * @param {Sheet} sheet
 * @param {string} fileId
 */
function isAlreadyQueued(sheet, fileId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return false;
  }
  var fileIds = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  return fileIds.some(function (row) {
    return row[0] === fileId;
  });
}

/**
 * Returns the "Queue" sheet rows get appended to, creating the spreadsheet
 * on first use and persisting its ID in Script Properties so later calls
 * reuse the same one rather than creating a new spreadsheet every time.
 */
function getOrCreateQueueSheet() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty(PROP_QUEUE_SPREADSHEET_ID);
  var spreadsheet = null;

  if (spreadsheetId) {
    try {
      spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } catch (err) {
      Logger.log('Stored queue spreadsheet %s is no longer accessible (%s); creating a new one.', spreadsheetId, err);
    }
  }

  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create('BFR Drive Watcher - Processing Queue');
    var newSheet = spreadsheet.getSheets()[0];
    newSheet.setName(QUEUE_SHEET_NAME);
    newSheet.appendRow(QUEUE_HEADERS);
    props.setProperty(PROP_QUEUE_SPREADSHEET_ID, spreadsheet.getId());
    Logger.log('Created new queue spreadsheet: %s', spreadsheet.getUrl());
  }

  // Runs on every call, not just creation -- also retroactively relocates a
  // queue spreadsheet that was created before GENERATED_SHEETS_FOLDER_ID
  // was configured. Cheap no-op once the file is already in place.
  moveToGeneratedSheetsFolder(spreadsheet.getId());

  var sheet = spreadsheet.getSheetByName(QUEUE_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(QUEUE_SHEET_NAME);
    sheet.appendRow(QUEUE_HEADERS);
  }
  return sheet;
}

/**
 * Files `fileId` into GENERATED_SHEETS_FOLDER_ID if it isn't already there.
 * Generic on purpose -- reusable for whatever other generated spreadsheets
 * get added later, not just the processing queue.
 * @param {string} fileId
 */
function moveToGeneratedSheetsFolder(fileId) {
  var file = DriveApp.getFileById(fileId);
  var parents = file.getParents();
  var alreadyInPlace = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === GENERATED_SHEETS_FOLDER_ID) {
      alreadyInPlace = true;
    }
  }
  if (!alreadyInPlace) {
    file.moveTo(DriveApp.getFolderById(GENERATED_SHEETS_FOLDER_ID));
    Logger.log('Moved %s into the generated-sheets folder.', file.getName());
  }
}

/**
 * One-time manual convenience: run this from the editor (same reason as
 * startWatch/installRenewalTrigger -- see the "Running functions" note in
 * ingestion/drive-watcher/README.md) to grant the Sheets scope this file
 * needs and confirm the queue spreadsheet gets created, without waiting
 * for a real post.zip notification to trigger it first.
 */
function ensureQueueSheetExists() {
  var sheet = getOrCreateQueueSheet();
  Logger.log('Queue sheet ready: %s', sheet.getParent().getUrl());
}

var QUEUE_PROTECTION_DESCRIPTION =
  'BFR Drive Watcher queue -- edited by automation; manual edits can corrupt in-flight rows';

/**
 * One-time manual setup (editor UI, not clasp run -- same reason as
 * ensureQueueSheetExists above): adds a warning-only protection over the
 * whole queue sheet, so an accidental fill-handle drag / paste / "Smart
 * Fill" suggestion click in the browser -- confirmed to actually happen
 * (2026-07-29: a queue row, and separately the header row, both got every
 * column overwritten with a single column's value after the sheet was open
 * in a browser) -- surfaces a "you're editing a protected range" warning
 * instead of silently corrupting a row. Sheet-level (not a fixed A1:F-style
 * range) so it automatically covers rows appended after this runs, not
 * just what exists right now.
 *
 * Warning-only, not a hard restriction: it has no effect at all on
 * automated writes (Apps Script's own triggers, and the Python consumer's
 * Sheets API calls both bypass UI-only warnings entirely), and a human can
 * still click through and edit if they really need to -- this is a speed
 * bump against accidents, not access control. Safe to re-run: removes any
 * protection this function previously added first, rather than stacking
 * duplicates.
 */
function protectQueueSheet() {
  var sheet = getOrCreateQueueSheet();

  sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (protection) {
    if (protection.getDescription() === QUEUE_PROTECTION_DESCRIPTION) {
      protection.remove();
    }
  });

  var protection = sheet.protect().setDescription(QUEUE_PROTECTION_DESCRIPTION);
  protection.setWarningOnly(true);

  Logger.log('Warning-only protection applied to the whole "%s" sheet.', sheet.getName());
}
