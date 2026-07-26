/**
 * Hands a detected, relevant file off to whatever does the real ingestion
 * work. What that "whatever" is is an open question -- see TODO below.
 */

/**
 * TODO: not decided yet. Options on the table, not chosen:
 * - Write a row to a "processing queue" Google Sheet that a scheduled
 *   Python job (ingestion/parsers/) polls.
 * - POST to an external endpoint (e.g. a Cloud Function) that runs the
 *   Python parsers directly and writes to data/results.csv.
 * Pick one before implementing -- don't default into either silently.
 * @param {Object} file
 */
function handOffNewFile(file) {
  throw new Error('TODO: not implemented -- see Dispatcher.gs');
}
