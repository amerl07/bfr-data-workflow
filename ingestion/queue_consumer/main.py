"""Queue consumer entry point.

Reads "pending" rows from the drive-watcher's processing-queue spreadsheet
(see ingestion/drive-watcher/Dispatcher.gs). Each row's Drive file may be
either a `post_<job_name>.zip` or an already-unzipped `post_<job_name>`
folder (see BatchFolderDetector.gs cases 2/3 vs. 4) -- materialize_post_contents
below handles both, downloading+unzipping+re-uploading images for the zip
case, or just listing children for the folder case, so that either way every
scene image ends up with a real Drive file id (see CONTRIBUTING.md §4's
"link only" gap). That part runs regardless of parser status.

What still doesn't fully run: sim_filename_parser and post_zip_classifier
are implemented; force_reports_parser now parses the real (confirmed)
format too, but deliberately doesn't populate CL/CD (no reference constants
to compute a coefficient from raw Newtons -- see its docstring) or
swept_variable/swept_range (confirmed absent from the format). Blocked past
that point on reconcile_isolated_vs_fullcar and, when a batch folder is
involved, folder_name_parser -- still stubs. This consumer treats a stub's
NotImplementedError as an expected, not-yet-unblocked state: it marks the
row "blocked: <reason>" and moves on, rather than faking a result row.

One-time setup:
1. In Google Cloud Console, create an OAuth 2.0 Client ID of type
   "Desktop app" (this needs a real GCP project -- unlike the Apps Script
   side, there's no way around that for external API access from Python).
   Enable the Google Sheets API and Google Drive API for that project.
2. Download the client secret JSON and save it as
   ingestion/queue_consumer/credentials.json (gitignored).
3. Run `python -m ingestion.queue_consumer.main` from the repo root. The
   first run opens a browser for one-time consent; a token is then cached
   at ingestion/queue_consumer/token.json (also gitignored) for later runs.
"""

import io
import tempfile
import zipfile
import csv
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

from ingestion.parsers import (
    folder_name_parser,
    force_reports_parser,
    post_zip_classifier,
    sim_filename_parser,
)

QUEUE_SPREADSHEET_ID = "1wsy2Wxk_wnQJ9HZp4YuSpW2W9VJ84CxjgcmKxb90JYQ"

QUEUE_SHEET_NAME = "Queue"
# Matches Dispatcher.gs's QUEUE_HEADERS: detected_at, file_id, file_name,
# batch_folder_id, batch_folder_name, status.
QUEUE_RANGE = f"{QUEUE_SHEET_NAME}!A2:F"
STATUS_COLUMN = "F"

FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"

SCOPES = [
    # Not .readonly: uploading extracted images back to Drive (see
    # materialize_post_contents) needs write access.
    "https://www.googleapis.com/auth/drive",
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
    # No CL/CD -- force_reports.txt only has raw forces, not coefficients
    # (no reference velocity/area/air-density to compute one from), and
    # getting those params out of the sims is hard for this team right now
    # -- see force_reports_parser.py's docstring. raw_force_values stores
    # everything force_reports.txt has instead.
    "raw_force_values",
    "CoP",
    "CoP_meters",
    "swept_variable",
    "swept_range",
    "scene_image_refs",
    "source_drive_folder",
]


def main():
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
        file_names, filename_to_drive_id, force_report_text = materialize_post_contents(
            drive, file_id, file_name, batch_folder_id
        )
        result_row = build_result_row(
            file_name,
            batch_folder_id,
            batch_folder_name,
            file_names,
            filename_to_drive_id,
            force_report_text,
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


def materialize_post_contents(drive, file_id, file_name, batch_folder_id):
    """Makes a post job's contents locally-readable and Drive-linkable
    regardless of whether it arrived as a post_<job_name>.zip or an
    already-unzipped post_<job_name> folder (BatchFolderDetector.gs cases
    2/3 vs. 4). Returns (file_names, filename_to_drive_id, force_report_text).

    This is deliberately independent of ingestion/parsers/'s stub status --
    downloading, unzipping, listing, and re-uploading isn't "parsing", none
    of it requires knowing anything about the files' internal formats, so
    it runs (and is directly observable in Drive) even while the actual
    parsing below is still blocked.
    """
    metadata = drive.files().get(fileId=file_id, fields="id, name, mimeType, parents").execute()

    if metadata["mimeType"] == FOLDER_MIME_TYPE:
        # Already unzipped -- every child is already an individual Drive
        # file, nothing to extract or re-upload.
        children = list_drive_children(drive, file_id)
        filename_to_drive_id = {child["name"]: child["id"] for child in children}
        force_report_id = filename_to_drive_id.get("force_reports.txt")
        force_report_text = (
            download_drive_file_text(drive, force_report_id) if force_report_id else ""
        )
        return list(filename_to_drive_id), filename_to_drive_id, force_report_text

    # Zipped: download, extract locally, then re-upload the extracted
    # images to a sibling "<job_name>_extracted" Drive folder so each one
    # gets a real Drive file id too -- see CONTRIBUTING.md §4. Named
    # without a "post_" prefix, and placed next to (not directly under
    # WATCHED_FOLDER_ID unless the zip itself was loose there), so
    # BatchFolderDetector.gs's isNewPostFolder/isNewBatchFolder never
    # mistake this for a new post job and reprocess it.
    parent_id = (metadata.get("parents") or [batch_folder_id])[0]
    job_label = _strip_post_zip_suffix(file_name)

    with tempfile.TemporaryDirectory() as tmp_dir:
        zip_path = download_zip(drive, file_id, file_name, tmp_dir)
        extracted_dir = unzip(zip_path, tmp_dir)
        file_names = [p.name for p in extracted_dir.iterdir()]
        force_report_path = extracted_dir / "force_reports.txt"
        force_report_text = (
            force_report_path.read_text() if force_report_path.exists() else ""
        )
        uploaded = upload_extracted_images(drive, parent_id, job_label, extracted_dir)

    filename_to_drive_id = {f["name"]: f["id"] for f in uploaded}
    return file_names, filename_to_drive_id, force_report_text


def _strip_post_zip_suffix(file_name):
    """Best-effort label for naming the "_extracted" Drive folder only --
    NOT the authoritative parsed job name (that's
    sim_filename_parser.parse_post_zip_filename's job, still a stub)."""
    label = file_name
    if label.startswith("post_"):
        label = label[len("post_"):]
    if label.endswith(".zip"):
        label = label[: -len(".zip")]
    return label or file_name


def list_drive_children(drive, folder_id):
    response = (
        drive.files()
        .list(q=f"'{folder_id}' in parents and trashed = false", fields="files(id, name, mimeType)")
        .execute()
    )
    return response.get("files", [])


def download_drive_file_text(drive, file_id):
    request = drive.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buffer.getvalue().decode("utf-8", errors="replace")


def download_zip(drive, file_id, file_name, tmp_dir):
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


def upload_extracted_images(drive, parent_folder_id, job_label, local_dir):
    folder_metadata = {
        "name": f"{job_label}_extracted",
        "mimeType": FOLDER_MIME_TYPE,
        "parents": [parent_folder_id],
    }
    extracted_folder = drive.files().create(body=folder_metadata, fields="id").execute()

    uploaded = []
    for path in sorted(local_dir.iterdir()):
        if not path.is_file():
            continue
        media = MediaFileUpload(str(path))
        file_metadata = {"name": path.name, "parents": [extracted_folder["id"]]}
        uploaded_file = (
            drive.files().create(body=file_metadata, media_body=media, fields="id, name").execute()
        )
        uploaded.append(uploaded_file)

    return uploaded


def build_result_row(
    file_name, batch_folder_id, batch_folder_name, file_names, filename_to_drive_id, force_report_text
):
    """Runs the materialized post job through ingestion/parsers/ and
    assembles a data/results.csv row per post_zip_file_format_spec.md §7
    (as amended -- see RESULTS_FIELDS' raw_force_values comment). Any
    parser call below still backed by a stub (folder_name_parser, when a
    batch folder is involved) raises NotImplementedError -- see
    process_row's handling of that.
    """
    sim_metadata = sim_filename_parser.parse_post_zip_filename(file_name)

    folder_metadata = None
    if batch_folder_name:
        folder_metadata = folder_name_parser.parse_batch_folder_name(batch_folder_name)

    classification = post_zip_classifier.classify_post_zip_contents(
        file_names, batch_folder_name
    )
    force_data = force_reports_parser.parse_force_report(force_report_text)

    isolated_vs_fullcar = sim_filename_parser.reconcile_isolated_vs_fullcar(
        folder_metadata.is_full_car if folder_metadata else None,
        sim_metadata.is_isolated,
    )

    return {
        "job_name": sim_metadata.job_name,
        "post_zip_name": file_name,
        "component": folder_metadata.component if folder_metadata else "",
        "sweep_type": folder_metadata.sweep_type if folder_metadata else "",
        "isolated_vs_fullcar": isolated_vs_fullcar,
        "date": sim_metadata.date,
        "owner_initials": sim_metadata.owner_initials,
        "raw_force_values": format_raw_force_values(force_data.raw_values, force_data.units),
        "CoP": force_data.CoP,
        "CoP_meters": force_data.CoP_meters,
        "swept_variable": force_data.swept_variable,
        "swept_range": force_data.swept_range,
        "scene_image_refs": format_scene_image_refs(classification, filename_to_drive_id),
        "source_drive_folder": batch_folder_id,
    }


def format_raw_force_values(raw_values, units):
    """Serializes force_reports.txt's raw label/value/unit rows into one
    ";"-joined "label=value unit" string for the raw_force_values column
    (see RESULTS_FIELDS' comment on why there's no CL/CD column). A plain
    join rather than fixed columns per label, since the label set is only
    confirmed against one sample so far and may not be identical across
    every component/sweep type (e.g. an isolated rear-wing run likely has
    no "FW DF" line at all).
    """
    parts = []
    for label, value in raw_values.items():
        unit = units.get(label, "")
        parts.append(f"{label}={value}{unit}".rstrip())
    return ";".join(parts)


def format_scene_image_refs(classification, filename_to_drive_id):
    """Builds Drive links for every scene image in classification's
    categories 1-4 (velocity slices, WSS, CP, setup scenes -- per spec §7,
    not the force report and not the unclassified bucket), using
    filename_to_drive_id (built by materialize_post_contents, which gives
    every scene image a real Drive file id regardless of whether the post
    job arrived as an already-unzipped Drive folder or a zip that got
    extracted and re-uploaded -- see CONTRIBUTING.md §4).

    A filename missing from filename_to_drive_id (shouldn't normally
    happen -- classification and filename_to_drive_id are built from the
    same file listing) is recorded as "MISSING:<name>" rather than silently
    dropped, so a mismatch is visible in data/results.csv instead of just
    producing a shorter-than-expected list.
    """
    scene_filenames = (
        [entry["file_name"] for entry in classification.velocity_slices]
        + [entry["file_name"] for entry in classification.wall_shear_stress]
        + [entry["file_name"] for entry in classification.pressure_coefficient]
        + classification.setup_scenes
    )

    links = []
    for name in scene_filenames:
        file_id = filename_to_drive_id.get(name)
        links.append(f"https://drive.google.com/file/d/{file_id}/view" if file_id else f"MISSING:{name}")

    return ";".join(links)


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
