"""Queue consumer entry point.

Reads "pending" rows from the drive-watcher's processing-queue spreadsheet
(see ingestion/drive-watcher/Dispatcher.gs), downloads and unzips each
post.zip, and runs it through ingestion/parsers/. As of this writing every
parser in ingestion/parsers/ is still a stub that raises NotImplementedError
(see their docstrings for why -- mainly: no sample force_reports.txt yet).
This consumer treats that as an expected, not-yet-unblocked state: it marks
the row "blocked: <reason>" and moves on, rather than faking a result row.
As parser stubs get filled in over time, rows will start actually reaching
data/results.csv with no changes needed here.

One-time setup:
1. In Google Cloud Console, create an OAuth 2.0 Client ID of type
   "Desktop app" (this needs a real GCP project -- unlike the Apps Script
   side, there's no way around that for external API access from Python).
   Enable the Google Sheets API and Google Drive API for that project.
2. Download the client secret JSON and save it as
   ingestion/queue_consumer/credentials.json (gitignored).
3. Fill in QUEUE_SPREADSHEET_ID below -- see Dispatcher.gs's Logger.log
   output, or the Apps Script project's Script Properties
   (DRIVE_WATCH_QUEUE_SPREADSHEET_ID), for the actual ID.
4. Run `python -m ingestion.queue_consumer.main` from the repo root. The
   first run opens a browser for one-time consent; a token is then cached
   at ingestion/queue_consumer/token.json (also gitignored) for later runs.
"""

import csv
import tempfile
import zipfile
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from ingestion.parsers import (
    folder_name_parser,
    force_reports_parser,
    post_zip_classifier,
    sim_filename_parser,
)

# TODO: fill in -- see Dispatcher.gs's Logger.log output, or Script
# Properties (DRIVE_WATCH_QUEUE_SPREADSHEET_ID) in the Apps Script project.
QUEUE_SPREADSHEET_ID = "TODO_QUEUE_SPREADSHEET_ID"

QUEUE_SHEET_NAME = "Queue"
# Matches Dispatcher.gs's QUEUE_HEADERS: detected_at, file_id, file_name,
# batch_folder_id, batch_folder_name, status.
QUEUE_RANGE = f"{QUEUE_SHEET_NAME}!A2:F"
STATUS_COLUMN = "F"

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
]

_MODULE_DIR = Path(__file__).resolve().parent
CREDENTIALS_PATH = _MODULE_DIR / "credentials.json"
TOKEN_PATH = _MODULE_DIR / "token.json"

RESULTS_CSV_PATH = _MODULE_DIR.parent.parent / "data" / "results.csv"
RESULTS_FIELDS = [
    "job_name",
    "post_zip_name",
    "component",
    "sweep_type",
    "isolated_vs_fullcar",
    "date",
    "owner_initials",
    "CL",
    "CD",
    "CoP",
    "swept_variable",
    "swept_range",
    "scene_image_refs",
    "source_drive_folder",
]


def main():
    if QUEUE_SPREADSHEET_ID.startswith("TODO_"):
        raise RuntimeError(
            "QUEUE_SPREADSHEET_ID is not set -- see this module's docstring."
        )

    creds = get_credentials()
    sheets = build("sheets", "v4", credentials=creds)
    drive = build("drive", "v3", credentials=creds)

    for row_number, row in read_pending_rows(sheets):
        process_row(sheets, drive, row_number, row)


def get_credentials():
    """OAuth installed-app flow, with the resulting token cached locally so
    only the first run needs an interactive browser consent."""
    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_PATH), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_PATH.write_text(creds.to_json())

    return creds


def read_pending_rows(sheets):
    """Returns [(sheet_row_number, row_values), ...] for queue rows whose
    status column is exactly "pending" (i.e. not already processing, done,
    or blocked/errored from a previous run)."""
    response = (
        sheets.spreadsheets()
        .values()
        .get(spreadsheetId=QUEUE_SPREADSHEET_ID, range=QUEUE_RANGE)
        .execute()
    )
    values = response.get("values", [])

    pending = []
    for offset, row in enumerate(values):
        sheet_row_number = offset + 2  # +2: 1-indexed, plus the header row.
        status = row[5] if len(row) > 5 else ""
        if status == "pending":
            pending.append((sheet_row_number, row))
    return pending


def process_row(sheets, drive, row_number, row):
    # Pad in case trailing empty cells were omitted by the Sheets API.
    detected_at, file_id, file_name, batch_folder_id, batch_folder_name = (
        row + [""] * 5
    )[:5]

    print(f"Processing {file_name} ({file_id})")
    set_status(sheets, row_number, "processing")

    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            zip_path = download_file(drive, file_id, file_name, tmp_dir)
            extracted_dir = unzip(zip_path, tmp_dir)
            result_row = parse_post_zip(
                extracted_dir, file_name, batch_folder_id, batch_folder_name
            )
        append_result_row(result_row)
        set_status(sheets, row_number, "done")
    except NotImplementedError as exc:
        # Expected, not a bug: one of ingestion/parsers/'s stubs. Leave the
        # row visibly blocked rather than losing track of it or fabricating
        # a result.
        print(f"Blocked on unimplemented parsing for {file_name}: {exc}")
        set_status(sheets, row_number, f"blocked: {exc}")
    except Exception as exc:  # noqa: BLE001 -- deliberately broad: log and
        # move on to the next row rather than letting one bad file stop the
        # whole batch.
        print(f"Error processing {file_name}: {exc}")
        set_status(sheets, row_number, f"error: {exc}")


def download_file(drive, file_id, file_name, tmp_dir):
    request = drive.files().get_media(fileId=file_id)
    dest_path = Path(tmp_dir) / file_name
    with dest_path.open("wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    return dest_path


def unzip(zip_path, tmp_dir):
    extract_dir = Path(tmp_dir) / "extracted"
    extract_dir.mkdir()
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(extract_dir)
    return extract_dir


def parse_post_zip(extracted_dir, post_zip_name, batch_folder_id, batch_folder_name):
    """Runs a single post.zip's extracted contents through
    ingestion/parsers/ and assembles a data/results.csv row per
    post_zip_file_format_spec.md §7. Every parser call below is currently a
    stub (raises NotImplementedError) -- see process_row's handling of
    that.
    """
    sim_metadata = sim_filename_parser.parse_post_zip_filename(post_zip_name)

    folder_metadata = None
    if batch_folder_name:
        folder_metadata = folder_name_parser.parse_batch_folder_name(batch_folder_name)

    file_names = [p.name for p in extracted_dir.iterdir()]
    classification = post_zip_classifier.classify_post_zip_contents(
        file_names, batch_folder_name
    )

    force_report_path = extracted_dir / "force_reports.txt"
    force_report_text = force_report_path.read_text() if force_report_path.exists() else ""
    force_data = force_reports_parser.parse_force_report(force_report_text)

    isolated_vs_fullcar = sim_filename_parser.reconcile_isolated_vs_fullcar(
        folder_metadata.is_full_car if folder_metadata else None,
        sim_metadata.is_isolated,
    )

    return {
        "job_name": sim_metadata.job_name,
        "post_zip_name": post_zip_name,
        "component": folder_metadata.component if folder_metadata else "",
        "sweep_type": folder_metadata.sweep_type if folder_metadata else "",
        "isolated_vs_fullcar": isolated_vs_fullcar,
        "date": sim_metadata.date,
        "owner_initials": sim_metadata.owner_initials,
        "CL": force_data.CL,
        "CD": force_data.CD,
        "CoP": force_data.CoP,
        "swept_variable": force_data.swept_variable,
        "swept_range": force_data.swept_range,
        "scene_image_refs": format_scene_image_refs(classification),
        "source_drive_folder": batch_folder_id,
    }


def format_scene_image_refs(classification):
    """TODO: not implemented -- and not just because it's unimplemented like
    the other parsers. There's a real design gap here, discovered while
    wiring this consumer up: CONTRIBUTING.md's "link only" image-handling
    decision assumes each scene image is individually addressable on Drive
    (a file ID/link per image), but in practice the images only exist as
    zip entries *inside* the post.zip -- they were never uploaded to Drive
    as individual files, so there's no per-image Drive link to store.

    Needs a decision before this can be implemented, along the lines of:
      (a) extract and re-upload each image to Drive individually to get
          real per-image links (in tension with "link only, no duplicate
          storage" -- this would itself be a form of duplicate storage), or
      (b) store one link to the post.zip itself in scene_image_refs
          instead of per-image links, or
      (c) actually adopt the "download a copy" fallback already discussed
          as a revisit trigger in CONTRIBUTING.md §4, with images stored
          at a non-repo destination the CSV then points to.
    Flagging here rather than silently picking one.
    """
    raise NotImplementedError(
        "scene_image_refs format is undecided -- see this function's docstring"
    )


def set_status(sheets, row_number, status):
    sheets.spreadsheets().values().update(
        spreadsheetId=QUEUE_SPREADSHEET_ID,
        range=f"{QUEUE_SHEET_NAME}!{STATUS_COLUMN}{row_number}",
        valueInputOption="RAW",
        body={"values": [[status]]},
    ).execute()


def append_result_row(row):
    with RESULTS_CSV_PATH.open("a", newline="") as f:
        csv.DictWriter(f, fieldnames=RESULTS_FIELDS).writerow(row)


if __name__ == "__main__":
    main()
