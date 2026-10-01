"""Sabalcore harvester entry point.

Pulls finished runs' `post_<job_name>.zip` straight off Sabalcore and drops
them into the watched Drive folder, so nobody has to download from the
relay app and re-upload by hand. Everything downstream is unchanged: the
drive-watcher detects the upload like any manual drop (BatchFolderDetector.gs
case 3 -- loose under WATCHED_FOLDER_ID, no batch folder), queues it, and
ingestion/queue_consumer parses it into data/results.csv.

Built independently of the relay app (Dohyun's -- we don't have its code):
this only needs SSH access to the shared brklyrc01 account, which the relay
itself also uses. It never writes anything on Sabalcore.

A run counts as finished when its directory
(/e/08/brklyrc01/bfr/<job_name>/) holds both `post_<job_name>.zip` and a
PBS stdout log `<job_name>.o<jobid>`. PBS writes that log at job exit,
after the post-processing zip step (confirmed 2026-09-30 against real run
directories: the .o file's mtime is always at or after the zip's), so a
zip still being written is never picked up.

A finished run is skipped as already handled when its post.zip name is
already in any of:
  - the drive-watcher's processing-queue sheet (column C, file_name) --
    every file the pipeline has ever detected, including ones that ended
    in "error"/"blocked", so a failed parse isn't re-uploaded forever;
  - data/results.csv's post_zip_name column -- rows ingested before the
    queue existed, or added by hand;
  - WATCHED_FOLDER_ID itself -- uploaded by a previous harvester run but not
    yet picked up by the watcher's 1-minute poll.
Plus HARVEST_SINCE (a YYYYMMDD cutoff compared against each job name's
trailing date): runs older than that are never uploaded, so turning this
on doesn't backfill every historical run on Sabalcore. Override with
--since to backfill on purpose.

TODO(sweeps): uploads always land loose (no batch folder), so batch/sweep
grouping (CONTRIBUTING.md §1b) still has to be done by hand by moving the
post.zips into a batch folder. Plan: add a "sweep" field to the relay
app's submit form (once we have its code), have the relay record the
batch folder name per run (e.g. a `batch.json` in the run directory), and
have this harvester read it and upload into that folder instead --
looking up the folder by name under WATCHED_FOLDER_ID and creating it
only if missing (this workflow's concurrency group already serializes
runs, so two sims finishing together can't create duplicate folders,
which would split the batch since web/lib/batch.ts groups by folder ID).

Auth:
  - Drive/Sheets: same OAuth-as-a-real-user token as the queue consumer
    (reuses its get_credentials -- see ingestion/queue_consumer/main.py's
    docstring for why not a service account).
  - Sabalcore: SABALCORE_HOST / SABALCORE_USER / SABALCORE_PASSWORD
    environment variables (GitHub Actions secrets in CI), falling back to
    ingestion/harvester/.env locally (gitignored, KEY=VALUE per line).

Usage (from repo root):
    .venv/bin/python -m ingestion.harvester.main --dry-run
    .venv/bin/python -m ingestion.harvester.main --since 20260801 --limit 3
"""

import argparse
import csv
import os
import posixpath
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

import paramiko
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from ingestion.queue_consumer.main import (
    QUEUE_SHEET_NAME,
    QUEUE_SPREADSHEET_ID,
    WATCHED_FOLDER_ID,
    get_credentials,
)

SABALCORE_RUN_ROOT = "/e/08/brklyrc01/bfr"

# Go-live date: runs dated before this are left alone unless --since says
# otherwise (see module docstring).
HARVEST_SINCE = "20260930"

# Caps how many zips (~110 MB each) one run uploads, so a backlog drains
# over several scheduled runs instead of one very long one.
DEFAULT_LIMIT = 5

_MODULE_DIR = Path(__file__).resolve().parent
ENV_PATH = _MODULE_DIR / ".env"
RESULTS_CSV_PATH = _MODULE_DIR.parent.parent / "data" / "results.csv"

_PBS_STDOUT_PATTERN = re.compile(r"\.o\d+$")
_TRAILING_DATE_PATTERN = re.compile(r"_(\d{8})$")


@dataclass
class FinishedRun:
    job_name: str
    zip_name: str
    zip_size: int

    @property
    def remote_zip_path(self):
        return posixpath.join(SABALCORE_RUN_ROOT, self.job_name, self.zip_name)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="list what would be uploaded, upload nothing")
    parser.add_argument("--since", default=os.environ.get("HARVEST_SINCE", HARVEST_SINCE),
                        help="YYYYMMDD; skip runs whose job-name date is earlier (default %(default)s)")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="max uploads this run")
    args = parser.parse_args()

    creds = get_credentials()
    drive = build("drive", "v3", credentials=creds)
    sheets = build("sheets", "v4", credentials=creds)

    already_handled = read_queued_file_names(sheets) | read_results_csv_zip_names() | list_watched_root_zip_names(drive)

    ssh = connect_sabalcore()
    try:
        runs = list_finished_runs(ssh)
        todo = []
        for run in runs:
            if run.zip_name in already_handled:
                continue
            run_date = job_name_date(run.job_name)
            if run_date is None or run_date < args.since:
                continue
            todo.append(run)

        print(f"{len(runs)} finished runs on Sabalcore, {len(todo)} to upload (since {args.since}).")
        for run in todo[: args.limit]:
            size_mb = run.zip_size / 1e6
            if args.dry_run:
                print(f"  would upload {run.zip_name} ({size_mb:.0f} MB)")
                continue
            print(f"  uploading {run.zip_name} ({size_mb:.0f} MB) ...")
            file_id = harvest_run(ssh, drive, run)
            print(f"    -> Drive file {file_id}")
        if len(todo) > args.limit:
            print(f"  {len(todo) - args.limit} more left for later runs (--limit {args.limit}).")
    finally:
        ssh.close()


def load_sabalcore_config():
    """SABALCORE_* from the environment, falling back to ENV_PATH."""
    file_values = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                file_values[key.strip()] = value.strip()

    config = {}
    for key in ("SABALCORE_HOST", "SABALCORE_USER", "SABALCORE_PASSWORD"):
        value = os.environ.get(key) or file_values.get(key)
        if not value:
            raise RuntimeError(f"{key} is not set (environment variable, or {ENV_PATH}).")
        config[key] = value
    return config


def connect_sabalcore():
    config = load_sabalcore_config()
    ssh = paramiko.SSHClient()
    # Ephemeral CI runners have no known_hosts to check against.
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        config["SABALCORE_HOST"],
        username=config["SABALCORE_USER"],
        password=config["SABALCORE_PASSWORD"],
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    return ssh


def list_finished_runs(ssh):
    """One `find` over every run directory rather than an SFTP listdir per
    run -- a single round trip regardless of how many runs exist."""
    command = (
        f"find {SABALCORE_RUN_ROOT} -mindepth 2 -maxdepth 2 -type f "
        r"\( -name 'post_*.zip' -o -name '*.o[0-9]*' \) -printf '%h\t%f\t%s\n'"
    )
    _, stdout, stderr = ssh.exec_command(command)
    output = stdout.read().decode()
    if stdout.channel.recv_exit_status() != 0:
        raise RuntimeError(f"listing runs on Sabalcore failed: {stderr.read().decode().strip()}")

    zips = {}
    has_pbs_log = set()
    for line in output.splitlines():
        directory, file_name, size = line.split("\t")
        job_name = posixpath.basename(directory)
        # Only the zip named after its own run directory -- the post_
        # convention (post_zip_file_format_spec.md §0) is post_<job_name>.zip.
        if file_name == f"post_{job_name}.zip":
            zips[job_name] = int(size)
        elif file_name.startswith(job_name) and _PBS_STDOUT_PATTERN.search(file_name):
            has_pbs_log.add(job_name)

    return [
        FinishedRun(job_name, f"post_{job_name}.zip", size)
        for job_name, size in sorted(zips.items())
        if job_name in has_pbs_log
    ]


def job_name_date(job_name):
    match = _TRAILING_DATE_PATTERN.search(job_name)
    return match.group(1) if match else None


def read_queued_file_names(sheets):
    response = (
        sheets.spreadsheets()
        .values()
        .get(spreadsheetId=QUEUE_SPREADSHEET_ID, range=f"{QUEUE_SHEET_NAME}!C2:C")
        .execute()
    )
    return {row[0] for row in response.get("values", []) if row}


def read_results_csv_zip_names():
    if not RESULTS_CSV_PATH.exists():
        return set()
    with RESULTS_CSV_PATH.open(newline="") as f:
        return {row["post_zip_name"] for row in csv.DictReader(f) if row.get("post_zip_name")}


def list_watched_root_zip_names(drive):
    names = set()
    page_token = None
    while True:
        response = (
            drive.files()
            .list(
                q=f"'{WATCHED_FOLDER_ID}' in parents and name contains 'post_' and trashed = false",
                fields="nextPageToken, files(name)",
                pageToken=page_token,
            )
            .execute()
        )
        names.update(f["name"] for f in response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            return names


def harvest_run(ssh, drive, run):
    """SFTP the zip to a temp dir, then resumable-upload it into
    WATCHED_FOLDER_ID. The Drive file only exists once the upload
    completes, so the watcher never sees a partial zip."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        local_path = os.path.join(tmp_dir, run.zip_name)
        sftp = ssh.open_sftp()
        try:
            sftp.get(run.remote_zip_path, local_path)
        finally:
            sftp.close()

        media = MediaFileUpload(local_path, mimetype="application/zip", resumable=True, chunksize=16 * 1024 * 1024)
        created = (
            drive.files()
            .create(body={"name": run.zip_name, "parents": [WATCHED_FOLDER_ID]}, media_body=media, fields="id")
            .execute()
        )
        return created["id"]


if __name__ == "__main__":
    main()
