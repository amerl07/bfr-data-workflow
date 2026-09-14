"""Queue consumer entry point.

Reads "pending" rows from the drive-watcher's processing-queue spreadsheet
(see ingestion/drive-watcher/Dispatcher.gs). Each row's Drive file may be
either a `post_<job_name>.zip` or an already-unzipped `post_<job_name>`
folder (see BatchFolderDetector.gs cases 2/3 vs. 4) -- materialize_post_contents
below handles both, downloading+unzipping+re-uploading images for the zip
case, or just listing children for the folder case, so that either way every
scene image ends up with a real Drive file id (see CONTRIBUTING.md §4's
"link only" gap). That part runs regardless of parser status.

sim_filename_parser and folder_name_parser (2026-09-13 -- batch/sweep-folder
support, see CONTRIBUTING.md §1b) are both implemented; force_reports_parser
now parses the real (confirmed) format too, but deliberately doesn't
populate CL/CD (no reference constants to compute a coefficient from raw
Newtons -- see its docstring) or swept_variable/swept_range (confirmed
absent from the format -- swept_variable/swept_value come from
folder_name_parser + sim_filename_parser instead when a batch/sweep folder
is involved, see build_result_row). A stub's NotImplementedError (there are
none left as of this writing, but the mechanism stays for any future one) is
treated as an expected, not-yet-unblocked state: it marks the row
"blocked: <reason>" and moves on, rather than faking a result row. A real
parse failure (e.g. a folder or file name that just doesn't match its
convention) raises ValueError/etc. instead and is marked "error: <reason>".

Auth -- see get_credentials(). Both local runs and the scheduled GitHub
Actions run use the *same* OAuth installed-app credentials (a real Google
account, not a service account): a service account was tried first for the
automated run (see git history / .github/workflows/queue_consumer.yml
before 2026-08-01) but Drive rejects file creation from a service account
outside a Shared Drive with "Service Accounts do not have storage quota"
(storageQuotaExceeded) -- upload_extracted_images below needs to create new
Drive files, and this project doesn't have Shared Drive creation rights on
its Workspace org. Using a real account's OAuth token sidesteps that: every
Drive/Sheets call runs as that account, with its normal quota.

One-time setup (local):
1. In Google Cloud Console, create an OAuth 2.0 Client ID of type
   "Desktop app". Enable the Sheets and Drive APIs for that project. Set
   the OAuth consent screen's audience to Internal (or otherwise published)
   -- an External+Testing app's refresh tokens silently expire after 7
   days, which would break the scheduled CI run without warning.
2. Download the client secret JSON and save it as
   ingestion/queue_consumer/credentials.json (gitignored).
3. Run `python -m ingestion.queue_consumer.main` from the repo root. The
   first run opens a browser for one-time consent; a token (including a
   refresh_token, which is what makes unattended CI runs possible -- no
   browser needed once one exists) is then cached at
   ingestion/queue_consumer/token.json (also gitignored).

One-time setup (CI): paste the full contents of the token.json produced
above into a GitHub repo secret named GOOGLE_OAUTH_TOKEN_JSON (Settings ->
Secrets and variables -> Actions). The workflow
(.github/workflows/queue_consumer.yml) writes it to
ingestion/queue_consumer/token.json at runtime; from there get_credentials()
refreshes it exactly like a local run would. If the refresh_token is ever
revoked or expires, re-run step 3 above locally and update the secret with
the new token.json contents.
"""

import io
import tempfile
import zipfile
import csv
from pathlib import Path

from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

from ingestion.parsers import (
    folder_name_parser,
    force_reports_parser,
    sim_filename_parser,
)

QUEUE_SPREADSHEET_ID = "1wsy2Wxk_wnQJ9HZp4YuSpW2W9VJ84CxjgcmKxb90JYQ"

# Must match ingestion/drive-watcher/Config.gs's WATCHED_FOLDER_ID -- used
# as materialize_post_contents' last-resort fallback parent (see there).
WATCHED_FOLDER_ID = "1XhrMoU9ermfWZocgzl05-cHdmZexGKih"

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

# Force labels confirmed present in every real force_reports.txt sample so
# far (docs/force_reports.txt, plus every real upload processed since) --
# each gets its own results.csv column alongside the catch-all
# raw_force_values, for querying/sorting without re-parsing that string. A
# label from some future/different export shape that ISN'T in this map is
# never lost -- it just stays in raw_force_values only, not promoted to a
# column (per 2026-07-29 decision: don't invent columns for undefined
# labels). A known label simply absent from one report (e.g. an isolated
# run with no "FW DF" line) leaves its column blank, not an error.
#
# CoP/CoP_meters (2026-08-27) used to be handled as dedicated
# ForceReportData fields, populated by force_reports_parser.py itself --
# unified into this generic mechanism instead, since they were never
# actually special: just two more labels resolved via normalize_label.
# They're still two distinct entries below (and two distinct columns),
# since "CoP" and "CoP meters" are two distinct labels in the source file.
#
# 2026-08-27: "Total DF"/"Total Drag" map to full_car_df/full_car_drag, and
# "CoP"/"CoP meters" map to full_car_CoP/full_car_CoP_meters (renamed on
# the website side -- see web/lib/types.ts). "Total Aero DF" is back as
# total_aero_df (website re-added it).
#
# NOTE: this dict's *values* must each be a name that appears somewhere in
# RESULTS_FIELDS below, but (as of 2026-08-27) its *order* no longer
# determines RESULTS_FIELDS' order -- RESULTS_FIELDS is spelled out
# explicitly instead, to match data/results.csv's actual column order
# (which mirrors web/lib/types.ts's panel layout, not insertion order in
# this dict).
#
# Multiple keys CAN map to the same column (see below), one per confirmed
# export-vintage spelling of the same quantity, e.g. "Total DF" (older) and
# "Full Car DF" (newer) both -> full_car_df -- normalize_label only merges
# underscore/case/whitespace variants of the *same* wording, not a genuine
# reword like this. build_result_row's loop is written so a later key's
# miss (None) never clobbers an earlier key's hit for the same column.
#
# 2026-08-27 (second pass): scanned every raw_force_values string already
# in data/results.csv (30 real rows) plus docs/force_reports.txt for
# confirmed label text -- added everything below that's unambiguous (same
# unit across every occurrence checked). Left deliberately unmapped:
# "RW Mounting DF/Drag" (no corresponding SimRow field exists), "Cl"/"Cd"
# (distinct dimensionless quantities from ClA/CdA, not the same thing),
# "EL8 DF/Drag" (no EL8 field defined -- only EL4-7 exist), and bare
# "Full Car CoP" (genuinely ambiguous: one real row uses it as a duplicate
# of "CoP Meters" [unit "m"], two others use it as the plain percentage
# [no unit] -- handled by dedicated unit-aware code in build_result_row
# instead of a flat mapping here, same as the CoP/CoP_meters unification's
# original special case).
FORCE_LABEL_COLUMNS = {
    "Body DF": "body_df",
    "RW Drag": "rw_drag",
    "FW DF": "fw_df",
    "RW DF": "rw_df",
    "Total Drag": "full_car_drag",
    "Full Car Drag": "full_car_drag",
    "Total DF": "full_car_df",
    "Full Car DF": "full_car_df",
    "UT DF": "ut_df",
    "Cell count": "cell_count",
    "Total Aero DF": "total_aero_df",
    "Aero DF": "total_aero_df",
    "Wheel DF": "wheel_df",
    "Whisker DF": "whisker_df",
    "CoP": "full_car_CoP",
    "CoP meters": "full_car_CoP_meters",
    "Body Drag": "body_drag",
    "FW Drag": "fw_drag",
    "UT Drag": "ut_drag",
    "Wheel Drag": "wheel_drag",
    "Endplate DF": "endplate_df",
    "RW Endplate DF": "endplate_df",
    "Endplate Drag": "endplate_drag",
    "RW Endplate Drag": "endplate_drag",
    "Swan Neck DF": "swan_neck_df",
    "Swan Neck Drag": "swan_neck_dragf",
    "Carbon Rod DF": "carbon_rod_df",
    "Carbon Rod Drag": "carbon_rod_drag",
    "EL4 DF": "EL4_df",
    "RW EL4 DF": "EL4_df",
    "EL5 DF": "EL5_df",
    "RW EL5 DF": "EL5_df",
    "EL6 DF": "EL6_df",
    "EL7 DF": "EL7_df",
    "RW EL7 DF": "EL7_df",
    "EL4 Drag": "EL4_drag",
    "RW EL4 Drag": "EL4_drag",
    "EL5 Drag": "EL5_drag",
    "RW EL5 Drag": "EL5_drag",
    "EL6 Drag": "EL6_drag",
    "EL7 Drag": "EL7_drag",
    "RW EL7 Drag": "EL7_drag",
    "Frontal Area": "frontal_area",
    "RW Area": "RW_area",
    "FW Area": "FW_area",
    "UT Area": "UT_area",
    "ClA": "ClA",
    "CdA": "CdA",
    "UT CoP": "UT_CoP_meters",
    "CoP_Meters UT": "UT_CoP_meters",
    "RW CoP": "RW_CoP_meters",
    "CoP_Meters RW": "RW_CoP_meters",
    "Radiator MFR": "radiator_MFR",
    "Radiator MF Rate": "radiator_MFR",
    "Mass Flow Rate": "radiator_MFR",
    "Inlet MFA": "inlet_MF_averaged_pressure",
    "Inlet MF Averaged Pressure": "inlet_MF_averaged_pressure",
    "Inlet MFA Pressure": "inlet_MF_averaged_pressure",
    "Outlet MFA": "outlet_MF_averaged_pressure",
    "Outlet MF Averaged Pressure": "outlet_MF_averaged_pressure",
    "Outlet MFA Pressure": "outlet_MF_averaged_pressure",
    "Pressure Drop": "pressure_drop",
}

RESULTS_CSV_PATH = _MODULE_DIR.parent.parent / "data" / "results.csv"
# Must match data/results.csv's actual header exactly (name AND order) --
# append_result_row only ever appends using this list, it never rewrites
# the header on disk. Mirrors web/lib/types.ts's SimRow field order
# (2026-08-27). Most of the per-wing-element/area/radiator columns have no
# FORCE_LABEL_COLUMNS entry yet (see that dict's comment) and so are always
# blank for now -- not an error, just not wired up to a source label yet.
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
    # everything force_reports.txt has, verbatim, regardless of whether a
    # label made it into its own column below.
    "raw_force_values",
    # Downforce panel
    "full_car_df",
    "total_aero_df",
    "body_df",
    "fw_df",
    "rw_df",
    "ut_df",
    "wheel_df",
    "endplate_df",
    "swan_neck_df",
    "carbon_rod_df",
    "EL4_df",
    "EL5_df",
    "EL6_df",
    "EL7_df",
    # Drag panel
    "full_car_drag",
    "body_drag",
    "fw_drag",
    "rw_drag",
    "ut_drag",
    "wheel_drag",
    "endplate_drag",
    "swan_neck_dragf",
    "carbon_rod_drag",
    "EL4_drag",
    "EL5_drag",
    "EL6_drag",
    "EL7_drag",
    # Area and Coefficients panel
    "frontal_area",
    "RW_area",
    "FW_area",
    "UT_area",
    "ClA",
    "CdA",
    # Center of Pressure panel
    "full_car_CoP",
    "full_car_CoP_meters",
    "UT_CoP_meters",
    "RW_CoP_meters",
    # Radiator panel
    "radiator_MFR",
    "inlet_MF_averaged_pressure",
    "outlet_MF_averaged_pressure",
    "pressure_drop",
    # Sim Metadata panel
    "cell_count",
    "swept_variable",
    "swept_range",
    # This sim's own value/unit along swept_variable (e.g. 30.0 / "mm"),
    # parsed from its filename's DESCRIPTION token -- only populated when
    # the post job is inside a batch/sweep folder (see folder_name_parser.py
    # and sim_filename_parser.extract_swept_value). swept_range above is
    # deliberately NOT derived from these at ingestion time -- see
    # CONTRIBUTING.md §1b: doing so here would go stale as later sims in
    # the same batch land, so it's computed live in the web app instead
    # (web/lib/batch.ts) from all rows sharing source_drive_folder.
    "swept_value",
    "swept_value_unit",
    "scene_image_refs",
    "source_drive_folder",
    # Legacy -- no successor in the current schema, kept so existing
    # historical data isn't discarded. No longer populated going forward.
    "whisker_df",
]


def main():
    creds = get_credentials()
    sheets = build("sheets", "v4", credentials=creds)
    drive = build("drive", "v3", credentials=creds)

    for row_number, row in read_pending_rows(sheets):
        process_row(sheets, drive, row_number, row)


def get_credentials():
    """OAuth installed-app credentials -- see module docstring for why this
    (not a service account) is used for both local and CI runs. token.json
    is either already cached locally from a prior interactive run, or
    written fresh by the CI workflow from the GOOGLE_OAUTH_TOKEN_JSON
    secret; either way, its refresh_token lets this refresh silently with
    no browser. Only a genuinely first-ever run (no token.json anywhere)
    falls back to the interactive consent flow, which requires
    credentials.json and a browser -- i.e. local-only, never CI."""
    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except RefreshError as exc:
                raise RuntimeError(
                    "OAuth refresh failed -- token.json's refresh_token is no "
                    "longer valid (revoked, or expired from 7-day Testing-mode "
                    "OAuth consent screen expiry). Re-run "
                    "`.venv/bin/python -m ingestion.queue_consumer.main` "
                    "locally to regenerate ingestion/queue_consumer/token.json "
                    "via the interactive consent flow, then update the "
                    "GOOGLE_OAUTH_TOKEN_JSON GitHub repo secret with its new "
                    "contents."
                ) from exc
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
    #
    # Falls back to WATCHED_FOLDER_ID, not just batch_folder_id, when
    # metadata["parents"] comes back empty -- confirmed to happen in
    # practice (2026-07-29) for a loose zip (no batch folder) processed
    # very soon after the reading identity's Drive access was granted,
    # likely a permission-propagation delay. Without this, an empty
    # batch_folder_id (the loose-zip-with-no-batch-folder case) combines
    # with the empty parents to send Drive an empty-string parent id,
    # which Drive reports back as a cryptic "File not found: ." 404 rather
    # than anything actionable.
    parent_id = (metadata.get("parents") or [batch_folder_id])[0] or WATCHED_FOLDER_ID
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

    entries = list(extract_dir.iterdir())
    if len(entries) == 1 and entries[0].is_dir():
        # Confirmed against a real upload: some post.zip exports wrap
        # everything in a single top-level folder (e.g.
        # "post_<job_name>/CP_Top.png" instead of "CP_Top.png" at the zip
        # root) -- the flat-root assumption from the original sample
        # (docs/PostDotZip_FileNames.txt) doesn't universally hold. Without
        # this, the wrapper folder is the only thing seen at this level,
        # gets skipped (not a file) by upload_extracted_images, and every
        # downstream field silently ends up empty instead of erroring.
        return entries[0]
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
    (as amended -- see RESULTS_FIELDS' raw_force_values comment). A folder
    or file name that doesn't match its convention raises ValueError -- see
    process_row's handling of that.
    """
    sim_metadata = sim_filename_parser.parse_post_zip_filename(file_name)

    folder_metadata = None
    if batch_folder_name:
        folder_metadata = folder_name_parser.parse_batch_folder_name(batch_folder_name)

    force_data = force_reports_parser.parse_force_report(force_report_text)

    isolated_vs_fullcar = sim_filename_parser.reconcile_isolated_vs_fullcar(
        folder_metadata.is_full_car if folder_metadata else None,
        sim_metadata.is_full_car,
    )

    # swept_variable/value: force_reports.txt never has these (see
    # force_reports_parser's docstring), so folder_metadata -- when this
    # post job is inside a batch/sweep folder -- is the only source.
    # swept_value is this sim's own value along that variable, pulled from
    # its own filename's DESCRIPTION token (e.g. "MeshBase30mm" against a
    # folder-declared "MeshBase" -> 30.0, "mm"); left blank (not an error)
    # if the description doesn't actually encode a value along the folder's
    # variable, same "don't invent" spirit as elsewhere in this module.
    swept_variable = folder_metadata.swept_variable if folder_metadata else force_data.swept_variable
    swept_value = None
    swept_value_unit = ""
    if folder_metadata:
        extracted = sim_filename_parser.extract_swept_value(
            sim_metadata.description, folder_metadata.swept_variable
        )
        if extracted:
            swept_value, swept_value_unit = extracted

    row = {
        "job_name": sim_metadata.job_name,
        "post_zip_name": file_name,
        # Filename-derived ({INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}
        # _{YYYYMMDD}, Proposal Outline §5), not folder_metadata --
        # component/sweep_type still come from the post.zip name itself even
        # when a batch folder is present, matching isolated_vs_fullcar's
        # "filename is authoritative, folder is cross-checked" treatment
        # above rather than being overridden by it.
        "component": sim_metadata.component,
        "sweep_type": sim_metadata.sweep_type,
        "isolated_vs_fullcar": isolated_vs_fullcar,
        "date": sim_metadata.date,
        "owner_initials": sim_metadata.owner_initials,
        "raw_force_values": format_raw_force_values(force_data.raw_values, force_data.units),
        "swept_variable": swept_variable,
        "swept_range": force_data.swept_range,
        "swept_value": swept_value,
        "swept_value_unit": swept_value_unit,
        "scene_image_refs": format_scene_image_refs(file_names, filename_to_drive_id),
        "source_drive_folder": batch_folder_id,
    }
    # normalize_label so this matches regardless of which confirmed label
    # spelling the source file used (underscore vs space, case, or -- as of
    # 2026-08-27 -- an entirely different reworded spelling registered as a
    # second FORCE_LABEL_COLUMNS key for the same column) -- see
    # force_reports_parser.py's module docstring, 2026-08-01 finding.
    normalized_raw_values = {
        force_reports_parser.normalize_label(label): value
        for label, value in force_data.raw_values.items()
    }
    normalized_units = {
        force_reports_parser.normalize_label(label): force_data.units.get(label, "")
        for label in force_data.raw_values
    }
    for label, column in FORCE_LABEL_COLUMNS.items():
        value = normalized_raw_values.get(force_reports_parser.normalize_label(label))
        # Only overwrite if this label actually matched -- multiple labels
        # can map to the same column (different export vintages' spelling
        # of the same quantity), and only one of them will ever be present
        # in a given row. Without this guard, a later key's miss would
        # clobber an earlier key's real hit for the same column with None.
        if value is not None:
            row[column] = value
        elif column not in row:
            row[column] = None

    # Bare "Full Car CoP" is genuinely ambiguous across export vintages --
    # one real row uses it as a duplicate of "CoP Meters" (unit "m"), two
    # others use it as the plain percentage (no unit) with no separate
    # meters value at all. Resolved by that occurrence's own unit, and only
    # as a fallback when the unambiguous "CoP"/"CoP meters" labels (above)
    # are absent -- see FORCE_LABEL_COLUMNS' comment.
    full_car_cop_value = normalized_raw_values.get("full car cop")
    if full_car_cop_value is not None:
        if normalized_units.get("full car cop") == "m":
            if row.get("full_car_CoP_meters") is None:
                row["full_car_CoP_meters"] = full_car_cop_value
        else:
            if row.get("full_car_CoP") is None:
                row["full_car_CoP"] = full_car_cop_value

    return row


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


def format_scene_image_refs(file_names, filename_to_drive_id):
    """Builds Drive links for every scene image in the post job -- every
    file except force_reports.txt, listed unfiltered rather than matched
    against per-category filename patterns. DECIDED 2026-08-01: every real
    batch seen so far has a different image count and naming scheme (see
    docs/post_zip_file_format_spec.md's top-of-file note), so classifying
    by filename pattern (the old post_zip_classifier.py approach) silently
    dropped files that didn't match a known shape. Listing everything
    except the force report is the only rule that holds across batches.

    filename_to_drive_id is built by materialize_post_contents, which gives
    every scene image a real Drive file id regardless of whether the post
    job arrived as an already-unzipped Drive folder or a zip that got
    extracted and re-uploaded -- see CONTRIBUTING.md §3.

    A filename missing from filename_to_drive_id (shouldn't normally
    happen -- both come from the same file listing) is recorded as
    "MISSING:<name>" rather than silently dropped, so a mismatch is visible
    in data/results.csv instead of just producing a shorter-than-expected
    list.
    """
    links = []
    for name in file_names:
        if name == "force_reports.txt":
            continue
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
    """Appends one row to data/results.csv, guarding against the file not
    already ending in a newline -- confirmed to actually happen in practice
    (2026-07-27): opening in append mode and writing a row assumes the
    existing content is already newline-terminated, and if it isn't, the
    new row gets concatenated directly onto the end of the previous line
    instead of starting a fresh one. Checked (not just assumed) on every
    call rather than only fixed once, since something outside this script's
    control -- editor/linter, manual edits -- can just as easily strip a
    trailing newline between two runs.
    """
    if RESULTS_CSV_PATH.exists() and RESULTS_CSV_PATH.stat().st_size > 0:
        with RESULTS_CSV_PATH.open("rb") as f:
            f.seek(-1, 2)
            needs_newline = f.read(1) not in (b"\n", b"\r")
    else:
        needs_newline = False

    with RESULTS_CSV_PATH.open("a", newline="") as f:
        if needs_newline:
            f.write("\n")
        csv.DictWriter(f, fieldnames=RESULTS_FIELDS).writerow(row)


if __name__ == "__main__":
    main()
