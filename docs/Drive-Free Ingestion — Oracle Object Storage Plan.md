# Drive-Free Ingestion — Oracle Object Storage Plan

**Status:** proposal, not implemented · **Written:** 2026-09-30

Replace Google Drive as the pipeline's storage and handoff layer with
Oracle Cloud Infrastructure (OCI) Always Free **Object Storage**. GitHub
Actions keeps doing all the compute. There is no VM to run.

---

## 1. Why

| Problem today | Cause |
|---|---|
| Fills a personal Drive (~230 MB per sim; ~35 GB per 150-sim season) | Both the `post.zip` (~113 MB) and its re-uploaded `_extracted` PNGs (~118 MB) are kept |
| Breaks after graduation | Everything is owned by `liuyumo@berkeley.edu`; deactivating it kills every image link in `data/results.csv` |
| Three hops and three schedules | harvester → Drive → Apps Script watcher (1 min) → queue sheet → consumer (5 min) |
| Fragile auth | Google OAuth refresh token for a real user, in CI; Testing-mode tokens expire after 7 days |
| Web app needs a Drive API key | Drive URLs are opaque IDs, so `web/hooks/useDriveFileNames.ts` calls the Drive API to learn each image's file name |

## 2. Target architecture

```
cron-job.org ──▶ GitHub Actions: queue_consumer.yml → single "ingest" job (every 5 min)
                   1. SSH to Sabalcore; list finished runs (post_<job>.zip + <job>.o<id>)
                   2. skip jobs already in data/results.csv or data/ingest_log.csv
                   3. SFTP post.zip to the runner, unzip
                   4. parse: sim_filename_parser + force_reports_parser (unchanged)
                   5. convert each PNG → WebP full (q95) + thumbnail (~640 px wide)
                   6. upload to OCI bucket under sims/<job_name>/...
                   7. append row to data/results.csv, outcome to data/ingest_log.csv, commit
                 ▼
GitHub Pages web app ──▶ <img src> straight from the bucket's public HTTPS URLs
```

Removed: Drive watcher (Apps Script), the processing-queue Google Sheet,
the `GOOGLE_OAUTH_TOKEN_JSON` secret, the `NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY`
web key, the `_extracted` Drive folders, and the stored `post.zip`s.

Unchanged: Sabalcore + the relay app, the parsers in `ingestion/parsers/`,
the `results.csv` schema (apart from what `scene_image_refs` holds), the
cron-job.org trigger, and GitHub Pages hosting.

## 3. Storage design

### Bucket

- One bucket, e.g. `bfr-sim-results`, in the account's **home region**
  (Always Free resources only exist there; pick one close to Berkeley, e.g.
  US West (San Jose)).
- Visibility: **Public, `ObjectReadWithoutList`**. Anyone can fetch an
  object by its exact URL, but nobody can list the bucket.
- Standard tier only. Archive and Infrequent Access aren't worth the
  retrieval delay for images the web app shows.

### Object layout

```
sims/<job_name>/full/<scene>.webp        # WebP q95, original 2560×1440
sims/<job_name>/thumb/<scene>.webp       # WebP, ~640 px wide, for galleries/cards
sims/<job_name>/force_reports.txt        # raw source, kept for reparsing (a few KB)
```

`<job_name>` is already unique per Sabalcore run (it's the run directory
name), so keys never collide. Every object gets
`Cache-Control: public, max-age=31536000, immutable`, because nothing is ever
overwritten in place. Browsers then cache images instead of re-requesting
them (see §8, request limits).

### Sizes (measured 2026-09-30 on `DY_RW_noLouvres_Straight_20260914`)

| | PNG today | WebP q95 | WebP q85 |
|---|---|---|---|
| Velocity_X_2.00 | 3.84 MB | 0.54 MB | 0.26 MB |
| CP_Bottom | 1.00 MB | 0.19 MB | 0.10 MB |
| WSS_Left | 0.63 MB | 0.19 MB | 0.11 MB |

At 52 scenes per sim, that's about **16 MB per sim** at q95, plus about 1–2 MB of thumbnails.

| | Per sim | Per season (150) | Existing (~52) |
|---|---|---|---|
| Today (Drive) | ~230 MB | ~35 GB | ~12 GB |
| Proposed (OCI) | ~18 MB | ~2.7 GB | ~0.9 GB |

The 20 GB Always Free allowance holds about 7 seasons.

### What `scene_image_refs` holds

Store **object keys relative to the bucket**, not full URLs:

```
sims/DY_RW_noLouvres_Straight_20260914/full/CP_Bottom.webp;sims/.../full/WSS_Left.webp;...
```

The web app adds a base URL from config (`NEXT_PUBLIC_IMAGE_BASE_URL`),
and the thumbnail path is derived by swapping `/full/` for `/thumb/`. If the
bucket ever moves (another region, R2, etc.), only that one setting changes,
not every row. The file name is also readable from the key, so the Drive
name lookup goes away.

## 4. Changes by area

### Pipeline (`ingestion/`)

- **`harvester/main.py` becomes the ingest job.** It keeps run discovery and
  the HARVEST_SINCE / `--since` / `--job` / `--limit` / `--dry-run` options,
  and replaces "upload zip to Drive" with unzip → parse → convert → upload →
  append row.
- **Move the row-building logic out of `queue_consumer/main.py`.**
  `build_result_row`, `FORCE_LABEL_COLUMNS`, `RESULTS_FIELDS` and
  `append_result_row` go into a Drive-free module (e.g.
  `ingestion/results.py`) that the ingest job imports.
  `format_scene_image_refs` changes to emit object keys.
- **New `ingestion/storage.py`.** It uploads to OCI through the
  **S3-compatible API** with `boto3`: endpoint
  `https://<namespace>.compat.objectstorage.<region>.oraclecloud.com`,
  authenticated with a Customer Secret Key. Using the S3 API keeps the code
  portable to R2/S3/GCS.
- **New `ingestion/images.py`.** PNG → WebP full + thumbnail with Pillow.
- **New `data/ingest_log.csv`**, committed next to `results.csv`, replacing
  the queue sheet: `job_name, ingested_at, status, message`. It records
  failures such as `error: job name does not match ...` so a badly named
  run isn't retried every 5 minutes, and the record is in git.
  To retry a job, delete its line.
- **Order of steps for each job:** upload all objects, then append the
  `results.csv` row, then append the `ingest_log.csv` line. A crash midway
  leaves orphan objects but never a row pointing to missing images. The
  next run retries the job and overwrites the same keys.
- `requirements.txt`: add `boto3` and `pillow`. Drop the
  `google-*` packages once the migration (§5) is finished.

### Workflow (`.github/workflows/queue_consumer.yml`)

- Merge `harvest` and `consume` into one `ingest` job. Keep the
  `queue-consumer` concurrency group and the commit/rebase/retry push step,
  and commit `data/ingest_log.csv` along with `results.csv`.
- Secrets: add `OCI_S3_ACCESS_KEY_ID`, `OCI_S3_SECRET_ACCESS_KEY`,
  `OCI_NAMESPACE`, `OCI_REGION` and `OCI_BUCKET`. Keep `SABALCORE_PASSWORD`.
  Remove `GOOGLE_OAUTH_TOKEN_JSON` after migration.
- Renaming the workflow file would break the cron-job.org dispatch URL, so
  keep the file name `queue_consumer.yml`.

### Web (`web/`)

- **`lib/drive.ts` → `lib/images.ts`.** Add `imageUrl(ref)`,
  `thumbnailUrl(ref)` and `imageName(ref)`. A ref that's still a Drive URL
  goes through the existing Drive helpers; a ref that's a bucket key goes
  through the base URL. Supporting both lets the web change ship before the
  migration and keeps working during it.
- **`hooks/useDriveFileName(s).ts`.** Return `imageName(ref)` synchronously
  for bucket keys; keep the Drive API path only for leftover Drive refs.
  Delete both hooks after the migration.
- **Components that currently import `lib/drive`:**
  `shared/image-overlay.tsx`, `explorer/sim-card.tsx`,
  `detail/scene-gallery.tsx` and `performance/scatter-tooltip.tsx`. Galleries
  and cards use `thumbnailUrl`; the overlay/"open full size" uses `imageUrl`.
- `NEXT_PUBLIC_IMAGE_BASE_URL` set in `deploy.yml`'s build env. It isn't a
  secret, since the bucket is public.
- No CORS setup needed: images load through `<img>`, not `fetch()`.

## 5. Migrating existing data

A one-time script (`ingestion/migrate_drive_to_oci.py`), run locally with
the existing Google OAuth token:

1. For each `results.csv` row whose `scene_image_refs` are Drive URLs: get
   each file's name and contents from Drive, convert to WebP full + thumb,
   and upload to `sims/<job_name>/...`.
2. Also upload `force_reports.txt` if it can be found (in the original zip
   in Drive, or still on Sabalcore).
3. Rewrite that row's `scene_image_refs` to bucket keys. Rows are migrated
   one at a time, and the script can be re-run without redoing finished rows.
4. Backfill `data/ingest_log.csv` with a `done` line for every existing row,
   plus the known `error` rows from the queue sheet (e.g.
   `DY_RW_e2_v2_Straight_20260825`), so the new job doesn't re-ingest them.
5. `--dry-run` first; spot-check a few sims in the deployed web app before
   deleting anything.

Deleting from Drive (zips, `_extracted` folders, and about 23 orphaned
`_extracted` folders left over from re-processing) and emptying its trash
(5.9 GB) is a **separate, manual step after verification**. It's never
done by the script.

## 6. Rollout order

Each step can ship on its own and leaves the system working.

1. **Setup (manual, §7).** Account, bucket, IAM user, keys, repo secrets.
2. **Web supports both ref formats.** Ship and confirm nothing changes.
3. **Ingest job writes to OCI.** New Sabalcore runs land in the bucket.
   The Drive watcher and consumer stay live but receive nothing new from the
   harvester.
4. **Migrate existing rows** (§5) and check them in the web app.
5. **Decommission.** Disable the Apps Script polling trigger, archive the
   queue sheet, remove the Google secret and the Drive API key, delete the
   Drive data, and remove the Drive-only code: `ingestion/drive-watcher/`,
   the Drive parts of `queue_consumer/`, and the Drive branches in `web/`.
6. **Docs.** README "Automated ingestion", CONTRIBUTING §3/§4 (image
   handling), the Team Usage Guide, and `web/README.md`'s Drive API key
   section.

## 7. One-time setup checklist

- [ ] OCI account under a **team-owned email** (not a personal berkeley.edu
      address), so it survives graduations. Sign-up needs a card for
      identity verification; Always Free resources aren't charged. Keep
      the account on Free Tier (don't upgrade to Pay As You Go), so
      going over the free allowance fails instead of billing.
- [ ] Home region chosen (can't be changed later).
- [ ] Bucket `bfr-sim-results`, Standard tier, visibility
      `ObjectReadWithoutList`.
- [ ] A dedicated IAM user (e.g. `bfr-ingest`) in a group whose policy only
      allows managing objects in that one bucket. Don't use the admin
      account's keys.
- [ ] A Customer Secret Key for that user (this is the S3 access key/secret
      pair).
- [ ] Note the Object Storage **namespace** (Tenancy details page).
- [ ] Repo secrets added (§4, Workflow).
- [ ] At least two team members with admin access to the OCI account.

## 8. Risks and open questions

- **Request limits (verify before committing).** Always Free Object
  Storage is documented as 20 GB plus a monthly cap on API requests
  (~50,000). It's unclear whether anonymous GETs on a public bucket count
  towards that cap. Uploads are small (~105 PUTs per sim, ~16k per
  season). If reads count, a gallery page showing 52 thumbnails could use
  up the cap after roughly 1,000 uncached page views a month. Mitigations:
  the `immutable` cache headers in §3, and loading gallery images only as
  they scroll into view. Fallback: Cloudflare R2's free tier (10 GB,
  10M reads/month, no download fees). Because everything uses the S3 API
  and base URLs come from config, switching is a config change plus a
  copy of the bucket.
- **Free-tier limits change.** The 20 GB and request figures above are from
  Oracle's Always Free docs as last known. Recheck them at sign-up.
- **Public URLs.** Anyone with a link can view an image (no listing). That's
  the same exposure as today's "anyone with the link" Drive files.
- **Manual uploads stop working.** Today anyone can drop a `post.zip` into
  Drive (e.g. a local STAR-CCM+ run). Options, if that path is still needed:
  (a) keep the Drive watcher only for manual drops, at least until (b) or (c)
  exists; (b) an `inbox/` prefix in the bucket that teammates upload to via
  a write-only Pre-Authenticated Request URL, which the ingest job also
  scans; (c) commit-free upload through a small form in `web/`. **Decide
  before step 5 of the rollout.**
- **Sabalcore retention.** With zips no longer kept in Drive, the only
  full-fidelity original is on Sabalcore, which users can delete from the
  relay app. Accepted: `force_reports.txt` and q95 images are kept, and
  lossless PNGs aren't needed for review. Revisit if someone needs
  pixel-exact originals.
- **Batching.** Unaffected in principle, but `source_drive_folder` (which
  `web/lib/batch.ts` groups by) has no Drive folder to point to anymore.
  When the sweep TODO lands (relay form "sweep" field → batch name recorded
  per run), fill that column with the batch name instead, and consider
  renaming it to `batch_id`. Existing rows keep their Drive folder IDs as
  opaque group keys; they still group correctly.
- **Backups.** Images and the record of what was ingested are now split
  between OCI and git. Both are easy to back up; consider a
  periodic `rclone` copy of the bucket if the data becomes important.
