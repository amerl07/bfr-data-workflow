# Contributing / Naming Conventions

This is the living reference for how data flows into this repo's ingestion
pipeline. Treat it as a pinned reference, not a one-time announcement --
update it as new batches surface edge cases (per
`docs/post_zip_file_format_spec.md`'s own framing).

**Current scope:** the only thing currently dropped into Drive batch
folders is a post job, named per the convention in §2 below -- either as
`post_<job_name>.zip`, or as an already-unzipped `post_<job_name>` folder
(same naming, minus `.zip`; supported so its images are already
individually Drive-linkable with no extraction step -- see §4). No other
file types (raw CSVs, `.sim` files, stray images, etc.) are expected there
yet, and the drive-watcher and `ingestion/parsers/` code are built to
assume this -- they should not try to generically handle arbitrary file
types ahead of need. Support for other artifact types -- e.g. a CSV-based
Bayesian sweep trials log (see the open question in §6) -- is a known future
extension, not something to build out now.

## 1. Drive batch-folder convention

Applied at the **batch-folder** level, not to individual files inside it.
One folder per batch/session -- raw `post.zip` outputs are dropped in
unmodified, original filenames preserved.

```
{COMPONENT}_{VERSION}_{SWEEPTYPE}_{YYYYMMDD}_{INITIALS}
```

**Examples:**
```
RW_v3_VEL_20260709_YM/
UT_v1_YAW_20260709_LC/
FC_RWv3-UTv1-FWv2_VEL_20260709_YM/
```

**Component codes:** `RW` (rear wing), `FW` (front wing), `UT` (undertray),
`DIF` (diffuser), `SP` (side pod), `FC` (full car -- lists mounted
component versions hyphen-separated).

**Sweep type codes:** `VEL` (velocity), `YAW`, `RH` (ride height), `AOA`
(angle of attack), `COMBO` (multi-parameter).

**Rules:**
- Absence of `FC` implies an isolated-component run.
- Version bumps on any meaningful geometry change, however small.
- Initials are fixed per person, documented centrally (see §4 below).
- Swept parameter ranges are *not* encoded in the folder name -- they're
  pulled from `force_reports.txt` content instead, **if present** (see open
  questions).

## 2. Sabalcore `.sim` / `post.zip` filename convention

A second, independent naming layer -- the *outer* filenames Sabalcore
produces, underneath whatever Drive batch folder they end up in.

**`.sim` job name:**
```
<INITIALS>_<descriptor>_<YYYYMMDD>.sim
```
Isolated-part runs prefix the descriptor with `ISO_`, e.g.
`DY_ISO_RWv3_20260709.sim`.

**`post.zip` name:** wraps the `.sim` base --
```
post_<job_name>.zip
```
i.e. `post_<INITIALS>_<descriptor>_<YYYYMMDD>.zip` (or with `ISO_` in the
descriptor for isolated runs).

**Open question -- FC vs. `ISO_` cross-check:** the Drive folder convention
(§1) already encodes isolated-vs-fullcar via absence of the `FC` component
code. The Sabalcore `ISO_` prefix is a second, independent signal for the
same distinction, at a different naming layer. **Not decided:** whether the
parser should cross-check these two (folder says isolated, `.sim` name
should agree) or treat one as authoritative and the other as informal. See
`ingestion/parsers/sim_filename_parser.py::reconcile_isolated_vs_fullcar`,
which is stubbed specifically to hold this decision once it's made.

## 3. post.zip file categories (summary)

Full detail, including per-category naming patterns and every open
question, lives in `docs/post_zip_file_format_spec.md` -- read that before
touching `ingestion/parsers/post_zip_classifier.py`. Quick summary:

1. **Velocity slices** (`x_`/`y_` prefix) -- variable count/parameter per
   batch. **Open question:** the `x__`/`y__` double-underscore convention's
   meaning (negative vs. zero/positive) is ambiguous and contradicted within
   the one sample batch we have -- do not hardcode a sign rule until
   confirmed against the STAR-CCM+ export macro.
2. **Wall shear stress** (`WSS_` prefix) -- fixed 8-combination pattern, no
   ambiguity.
3. **Pressure coefficient** (`CP_` prefix) -- per-face and per-quadrant
   scenes. **Open questions:** what distinguishes a `_copy` variant from its
   non-copy counterpart (unconfirmed -- flag for whoever owns the export
   macro); whether `CpT_Sweep.png` (a summary/sweep plot, doesn't fit the
   per-face pattern) should be treated the same as directional CP scenes.
4. **Setup/reference scenes** -- fixed, always-present (`Vector_Scene_1.png`,
   `Mesh.png`, `Geometry.png`).
5. **Force report** (`force_reports.txt`) -- the one file that gets parsed
   into structured CL/CD/CoP(/swept-variable/swept-range) rows. Format
   entirely unconfirmed; no sample available yet.
6. **Unclassified/other** -- catch-all for anything not matching 1-5; must
   be logged with filename + batch folder name rather than silently dropped.

## 4. Image handling: link vs. download (decision record)

**Decision:** default to **link-only**. `data/results.csv` stores a Drive
file ID / shareable link per image (`scene_image_refs`), not a downloaded
copy.

**Reasoning:** simplest v1, no duplicate storage, no separate
storage/hosting destination to stand up.

**Tradeoff, accepted for now:** this makes the datasheet Drive-dependent --
links break if files get moved, deleted, or have their permissions changed.

**Revisit trigger:** if Drive links prove unreliable in practice, fall back
to downloading copies to a dedicated non-repo destination (e.g. a Drive
"processed" folder, or local/cloud storage the CSV then points to instead).
This is explicitly a decision to revisit, not a closed one -- update this
section if/when that happens.

**Gap discovered while wiring up `ingestion/queue_consumer/`, now fully
resolved:** this decision assumed each scene image is individually
addressable on Drive (a file ID/link per image), but scene images
originally only existed as entries *inside* the `post.zip` archive -- never
uploaded to Drive as individual files, so there was no per-image Drive link
to store. Resolved by option (a) below: the queue consumer extracts and
re-uploads each image from a processed `post.zip` into a sibling
`<job_name>_extracted` Drive folder, giving every image a real Drive file
id either way (whether the post job arrived zipped or as an already-unzipped
folder -- see the Current scope note above and
`ingestion/drive-watcher/BatchFolderDetector.gs` case 4).
`format_scene_image_refs` in `ingestion/queue_consumer/main.py` builds
`scene_image_refs` as a `;`-joined list of Drive view links (categories 1-4
only -- not the force report, not the unclassified bucket), using
`post_zip_classifier.py`'s now-decided per-image dict shape (each entry has
a `file_name` key).

## 5. `data/results.csv` schema

One row per `post.zip` processed. See
`docs/post_zip_file_format_spec.md` §7 for full detail.

| Column | Source |
|---|---|
| `job_name` | Sabalcore `.sim` filename base (§2) |
| `post_zip_name` | `post_<job_name>.zip` |
| `component` | Drive folder name / descriptor (§1) |
| `sweep_type` | Drive folder name (§1) |
| `isolated_vs_fullcar` | `FC` absence and/or `ISO_` prefix -- see the cross-check open question in §2 |
| `date` | `YYYYMMDD` from filename |
| `owner_initials` | From filename |
| `CL`, `CD`, `CoP` | Parsed from `force_reports.txt` (§3.5) |
| `swept_variable`, `swept_range` | From `force_reports.txt`, **if present** -- unconfirmed, see open questions |
| `scene_image_refs` | `;`-joined Drive view links, one per scene image (§4) |
| `source_drive_folder` | Path/link to the originating batch folder |

## 6. Open questions (consolidated)

Pulled from `docs/` into one place so they're easy to track:

- [ ] Does the Bayesian sweep macro output its own trials log? Format?
      (Proposal Outline §6)
- [ ] Confirm `force_reports.txt` includes swept variable + range, not just
      CL/CD/CoP at each point. (Proposal Outline §6, spec §5)
- [ ] `x_`/`y_` slice filename sign convention -- double-underscore means
      negative or zero/positive? Contradicted in the one sample batch.
      (spec §1)
- [ ] What distinguishes `CP_*_copy` files from their non-copy counterparts?
      (spec §3)
- [ ] Is `CpT_Sweep.png` a summary/sweep plot distinct from the directional
      CP scenes, or should it be classified the same way? (spec §3)
- [ ] FC-absence vs. `ISO_`-prefix cross-check policy -- cross-validate or
      pick one as authoritative? (spec §0, §7; see §2 above)
- [ ] Drive push-notification setup: does `script.google.com` work as a
      webhook receiver without extra domain verification for this project's
      setup? (`ingestion/drive-watcher/README.md`)
- [ ] How do people currently organize Sabalcore downloads in Drive, if at
      all -- any existing partial convention to build from? (Proposal
      Outline §6)
- [ ] Who has Sabalcore/Drive access broadly enough to support a shared
      watch-folder -- one shared login, or everyone individually? (Proposal
      Outline §6)
- [ ] Scope/intent of the separately-mentioned "spreadsheet to parameterize
      things to change" -- planning-input tool vs. results-logging tool?
      (Proposal Outline §6)
- [ ] Retention policy for `.sim` files (who hosts them, for how long).
      (Proposal Outline §6)

## 7. Owner-initials registry

Initials are fixed per person and used in both naming conventions above.
Keep this table current.

| Initials | Name |
|---|---|
| YM | Yumo |
| | |
