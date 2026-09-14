# Contributing / Naming Conventions

This is the living reference for how data flows into this repo's ingestion
pipeline. Treat it as a pinned reference, not a one-time announcement --
update it as new batches surface edge cases (per
`docs/post_zip_file_format_spec.md`'s own framing).

**Current scope:** the only thing currently dropped into the watched Drive
folder is a post job, named per the convention in §1 below -- either as
`post_<job_name>.zip`, or as an already-unzipped `post_<job_name>` folder
(same naming, minus `.zip`; supported so its images are already
individually Drive-linkable with no extraction step -- see §3). No other
file types (raw CSVs, `.sim` files, stray images, etc.) are expected there
yet, and the drive-watcher and `ingestion/parsers/` code are built to
assume this -- they should not try to generically handle arbitrary file
types ahead of need. Support for other artifact types -- e.g. a CSV-based
Bayesian sweep trials log (see the open question in §5) -- is a known future
extension, not something to build out now. A post job can still be dropped
loose (no batch folder) as before, or nested inside a named batch/sweep
folder -- see §1b for when and how to use one.

## 1. Source file naming convention

Decided 2026-07-29 (`docs/Aero Subsystem Data Workflow — Proposal Outline.md`
§5 is the authoritative source) -- **supersedes** the earlier two-layer
scheme (an independent Drive batch-folder convention plus a Sabalcore
`.sim`/`post.zip` convention with an `ISO_` prefix). There is now a single
naming layer, applied to the job name itself:

```
{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}
```

**Examples:**
```
NC_UT_NoFillets_Cornering_20260724
YL_WSK_VariableAoA_Straightline_20260529
```

**`.sim` / `post.zip` names:** the job name above is the `.sim` file's base
name; `post.zip` wraps it --
```
post_<job_name>.zip
```
i.e. `post_{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}.zip`.

**Component codes:** `RW` (rear wing), `FW` (front wing), `UT` (undertray),
`WSK` (whisker), `BW` (bodywork), `FC` (full car).

**Sweep type codes:** `CORNERING`, `STRAIGHTLINE`, `VEL` (velocity), `YAW`,
`RH` (ride height), `AOA` (angle of attack), `COMBO` (multi-parameter).
`CORNER`/`STRAIGHT` (the codes before the Team Usage Guide's 2026-08-01
update) still parse -- the parser case-insensitively treats them as
aliases of `CORNERING`/`STRAIGHTLINE` respectively (see
`sim_filename_parser.py::_SWEEP_TYPE_ALIASES`), so old and new filenames
land in the same `sweep_type` value in `data/results.csv`. The web app
(`web/lib/data.ts::normalizeSweepType`) applies the same case-insensitive
CORNER/STRAIGHT normalization a second time when it reads
`data/results.csv`, since a handful of rows in that file were added by
hand and bypassed this parser, so their `sweep_type` casing/code wouldn't
otherwise match rows the parser produced.

Neither code list is validated by the parser (`ingestion/parsers/sim_filename_parser.py`)
-- an unrecognized code still parses fine, it's just not one of the above.
This matches the same "parse whatever's possible, don't invent/reject"
approach used for force report labels (§4). The CORNER/STRAIGHT aliasing is
the one exception -- those two codes are specifically known to have two
live spellings, everything else is passed through as-is.

**Rules:**
- Each of the five fields is a single token -- no underscores within a
  field (`NoFillets`, not `No_Fillets`) -- since the parser splits on `_`
  and expects exactly five parts plus the date. A filename that doesn't fit
  this shape fails to parse and the row is marked `error: ...` in the queue
  rather than guessed at.
- Absence of `FC` as the `COMPONENT` token implies an isolated-component
  run -- this is now the **only** isolated-vs-fullcar signal (`isolated_vs_fullcar`
  in `data/results.csv` is `full_car` iff `COMPONENT == "FC"`). There's no
  separate `ISO_` prefix anymore. `reconcile_isolated_vs_fullcar` still
  accepts a second, Drive-batch-folder-derived signal for cross-checking
  (producing a `CONFLICT: ...` string on disagreement) but that signal is
  normally unavailable now that batch folders are out of scope -- see
  `ingestion/parsers/sim_filename_parser.py::reconcile_isolated_vs_fullcar`.
- Initials are fixed per person, documented centrally (see §6 below).
- Swept parameter ranges are *not* encoded in the name -- pulled from
  `force_reports.txt` content instead, **if present** (see open questions).

## 1b. Batch/sweep folder naming convention

Decided 2026-09-13, for the case where several sims are one run each of the
same parameter (e.g. mesh base size) at different values, and you want
`data/results.csv` and the web app to know they're a batch rather than
treating them as unrelated one-offs. Enclose them in a Drive folder, named
with the exact same five-token shape as §1, but with `DESCRIPTION` naming
the **variable being swept** instead of one value of it:

```
{INITIALS}_{COMPONENT}_{SWEPTVARIABLE}_{SWEEPTYPE}_{YYYYMMDD}
```

**Example:** folder `YL_FC_MeshBase_Straight_20260913`, containing
`post_YL_FC_MeshBase30mm_Straight_20260913.zip`,
`post_YL_FC_MeshBase35mm_Straight_20260913.zip`,
`post_YL_FC_MeshBase40mm_Straight_20260913.zip`, ... -- each file's own
`DESCRIPTION` is still `{SWEPTVARIABLE}{VALUE}{UNIT}` per §1, just with a
number+unit suffix appended (`ingestion/parsers/sim_filename_parser.py::extract_swept_value`
splits it back out, matched against the folder's declared `SWEPTVARIABLE`).
Drop it anywhere directly under the watched Drive folder, same as a loose
post.zip -- `ingestion/drive-watcher/BatchFolderDetector.gs` detects it
automatically (no drive-watcher changes needed; it already treats any
folder name that doesn't start with `post_` as a batch folder).

**Why the same shape as §1, not a new syntax:** nothing new to learn, and
`ingestion/parsers/folder_name_parser.py` reuses the same regex/sweep-type
normalization as `sim_filename_parser.py`.

**What this populates in `data/results.csv`:**
- `swept_variable` -- the folder's `SWEPTVARIABLE` token, e.g. `MeshBase`.
- `swept_value` / `swept_value_unit` -- this sim's own numeric value/unit,
  from its filename (e.g. `30` / `mm`).
- `isolated_vs_fullcar` -- now genuinely cross-checked against the folder's
  own `COMPONENT` token (the `CONFLICT: ...` mechanism in
  `reconcile_isolated_vs_fullcar`, previously dormant since batch folders
  were unused, is live again).
- `swept_range` -- **deliberately NOT populated here.** Computing a batch's
  min/max at ingestion time would go stale as later sims in the same batch
  land afterward. Instead it's computed live in the web app
  (`web/lib/batch.ts`) from every row sharing `source_drive_folder`, and
  shown on Simulation Detail's "Sweep Information" card, which also lists
  every sibling in the batch there -- that's the "batch" indicator.

A file inside a batch folder whose `DESCRIPTION` doesn't actually start
with the folder's `SWEPTVARIABLE` (typo, or an unrelated one-off dropped in
the same folder) doesn't block ingestion -- it still gets `swept_variable`
from the folder, just no `swept_value` (same "parse whatever matches,
don't invent/reject" rule as §1). A batch folder name that doesn't match
the convention above, though, is a real error (`error: ...` in the queue),
not silently ignored.

## 2. post.zip file categories (summary)

**Decided 2026-08-01: images are no longer classified by filename
pattern.** Every real batch seen so far has a different image count and
different names, so matching filenames against fixed per-category regexes
(the old `ingestion/parsers/post_zip_classifier.py`, now removed) silently
dropped anything that didn't fit a known shape. `scene_image_refs` now
lists every file in the post job except `force_reports.txt`, unfiltered --
see `ingestion/queue_consumer/main.py::format_scene_image_refs`.

The naming patterns below are still real and still documented in full in
`docs/post_zip_file_format_spec.md` -- useful if you're trying to figure
out what a given image *is*, e.g. for a future UI grouping feature -- but
nothing in the pipeline parses against them anymore. Quick summary:

1. **Velocity slices** (`x_`/`y_` prefix) -- variable count/parameter per
   batch. **Open question:** the `x__`/`y__` double-underscore convention's
   meaning (negative vs. zero/positive) is ambiguous and contradicted within
   the one sample batch we have -- do not hardcode a sign rule until
   confirmed against the STAR-CCM+ export macro.
2. **Wall shear stress** (`WSS_` prefix) -- the original 8-combination
   quadrant pattern (`WSS_{Top|Bottom}_{Front|Back}_{Right|Left}.png`), plus
   a per-face overview pattern (`WSS_{Top|Bottom|Right|Left|Front}.png`,
   mirroring CP_'s overview/quadrant split below) confirmed against a later
   real upload -- not in the original 76-file sample. Not fixed-count after
   all; variable like categories 1 and 3.
3. **Pressure coefficient** (`CP_` prefix) -- per-face and per-quadrant
   scenes. **Open questions:** what distinguishes a `_copy` variant from its
   non-copy counterpart (unconfirmed -- flag for whoever owns the export
   macro); whether `CpT_Sweep.png` (a summary/sweep plot, doesn't fit the
   per-face pattern) should be treated the same as directional CP scenes.
4. **Setup/reference scenes** -- fixed, always-present (`Vector_Scene_1.png`,
   `Mesh.png`, `Geometry.png`).
5. **Force report** (`force_reports.txt`) -- the one file that gets parsed
   into structured rows, and the one file excluded from `scene_image_refs`
   by name. Format confirmed against a real sample: raw force values
   (Newtons) and two CoP representations, not CL/CD coefficients, and no
   swept-variable/range. See §4/§5 below for the full detail.

## 3. Image handling: link vs. download (decision record)

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
`scene_image_refs` as a `;`-joined list of Drive view links for every file
in the post job except `force_reports.txt` (decided 2026-08-01 -- see §2
above; no longer filtered through per-category classification).

## 4. `data/results.csv` schema

One row per `post.zip` processed. See
`docs/post_zip_file_format_spec.md` §7 for full detail.

| Column | Source |
|---|---|
| `job_name` | Job name base, `{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}` (§1) |
| `post_zip_name` | `post_<job_name>.zip` |
| `component` | `COMPONENT` token from the filename (§1) |
| `sweep_type` | `SWEEPTYPE` token from the filename (§1) |
| `isolated_vs_fullcar` | `full_car` iff `COMPONENT == "FC"`, `isolated` otherwise, or `CONFLICT: ...` if a Drive-folder signal disagrees (§1) |
| `date` | `YYYYMMDD` from filename |
| `owner_initials` | `INITIALS` token from the filename (§1) |
| `raw_force_values` | `;`-joined `label=value unit` pairs, **everything** `force_reports.txt` has (§2.5), regardless of whether a label also got its own column below -- no data is ever only in the structured columns. |
| `body_df`, `rw_drag`, `fw_df`, `rw_df`, `total_drag`, `total_df`, `ut_df`, `cell_count`, `total_aero_df`, `wheel_df`, `whisker_df` | Decided 2026-07-29: each force label confirmed present in every real `force_reports.txt` sample so far gets its own numeric column too (`ingestion/queue_consumer/main.py::FORCE_LABEL_COLUMNS`), for querying/sorting without re-parsing `raw_force_values`. A label not in this fixed set (a future/different export shape) stays in `raw_force_values` only -- no column gets invented for it. A known label simply absent from one report (e.g. an isolated run with no `FW DF` line) leaves its column blank, not an error. No CL/CD column -- computing a real coefficient needs reference constants (velocity, area, air density) not present in the file, and getting those out of the sims is hard for this team right now. Values are exactly as the file reports them, including its own "half-car, undoubled" convention -- not doubled to a full-car representation. |
| `CoP` | `force_reports.txt`'s unitless `CoP` label -- a percentage (§2.5) |
| `CoP_meters` | `force_reports.txt`'s separate `CoP meters` label -- absolute distance in meters (§2.5); kept alongside `CoP` rather than picking one |
| `swept_variable` | **Confirmed absent** from `force_reports.txt`. Populated from the enclosing batch/sweep folder's name when the post.zip was dropped inside one (§1b), blank otherwise |
| `swept_range` | Deliberately left blank at ingestion time (would go stale mid-batch) -- computed live in the web app from sibling rows' `swept_value` instead, see §1b |
| `swept_value`, `swept_value_unit` | This sim's own value/unit along `swept_variable`, parsed from its own filename (§1b). Blank when there's no batch folder, or the filename doesn't encode a value along the folder's declared variable |
| `scene_image_refs` | `;`-joined Drive view links, one per scene image (§3) |
| `source_drive_folder` | Path/link to the originating batch folder, blank when the post.zip was dropped loose (no batch folder) |


## 5. Owner-initials registry

Initials are fixed per person and used in the naming convention above.
Existing initials are: 
- YL
- MT
- DY
- NC
- AV

## 6. Open questions (consolidated)

- [ ] **GitHub Actions `schedule:` trigger for `queue_consumer.yml` is
      unreliable.** Found 2026-07-29: observed runs 1.5-3 hours apart
      against a 5-10 minute configured interval. Confirmed to be a GitHub
      platform limitation (the `schedule:` event is explicitly best-effort/
      low-priority and can be delayed or dropped for hours, especially on
      private repos), not something fixable by changing the cron
      expression. `workflow_dispatch` runs (manual or API-triggered) don't
      have this problem. Decided for now: run the consumer manually. Real
      fix not yet implemented -- either an external cron service (e.g.
      cron-job.org) calling the `workflow_dispatch` REST API on a real
      schedule, or moving the consumer off GitHub Actions onto Google Cloud
      Scheduler + Cloud Function/Run. See README.md "Automated ingestion".
- [ ] Does the Bayesian sweep macro output its own trials log? Format?
      (Proposal Outline §6)
- [x] ~~Confirm `force_reports.txt` includes swept variable + range, not
      just CL/CD/CoP at each point.~~ **Answered, from a real sample
      (docs/force_reports.txt): no.** A single-run export has no swept
      variable/range at all -- just raw forces, CoP, and a couple of header
      comments. (Proposal Outline §6, spec §5)
- [x] ~~How to get real `CL`/`CD` coefficients.~~ **Decided: don't, for
      now.** `force_reports.txt` only has raw forces in Newtons, not
      coefficients, and getting the reference constants (velocity, area,
      air density) needed to compute one out of the sims is hard for this
      team right now -- `data/results.csv` stores `raw_force_values` plus a
      column per known force label instead. Revisit if those constants
      become available.
- [x] ~~`force_reports.txt` "half-car, undoubled" values -- double or
      not?~~ **Decided: leave as-is, no doubling, for now.**
- [x] ~~`CoP` vs. `CoP meters` -- which one?~~ **Decided: keep both.**
      `CoP` is the percentage, `CoP_meters` is the absolute distance.
- [x] ~~FC vs. `ISO_` cross-check.~~ **Superseded, not just decided:** the
      independent Sabalcore `ISO_` prefix no longer exists -- the new
      unified naming convention (§1) encodes isolated-vs-fullcar via the
      same `COMPONENT` token used for `component`, so there's only one
      filename-level signal now, not two to cross-check. A Drive-folder
      signal can still be cross-checked against it if that ever comes back
      into scope.
- [ ] `x_`/`y_` slice filename sign convention -- double-underscore means
      negative or zero/positive? Contradicted in the one sample batch.
      (spec §1)
- [ ] What distinguishes `CP_*_copy` files from their non-copy counterparts?
      (spec §3)
- [ ] Is `CpT_Sweep.png` a summary/sweep plot distinct from the directional
      CP scenes, or should it be classified the same way? (spec §3)
- [x] ~~Drive push-notification setup: does `script.google.com` work as a
      webhook receiver without extra domain verification for this project's
      setup?~~ **Deprioritized, not conclusively answered.** Push
      notifications never reliably reached `doPost` even after fixing two
      real bugs (stale deployment, too-infrequent channel renewal) --
      domain verification is the leading unconfirmed suspect. Rather than
      keep chasing it, `processChanges()` now runs on a 1-minute polling
      trigger instead; the push infrastructure is left running (faster if
      it ever starts working) but nothing depends on it. See
      `ingestion/drive-watcher/README.md`.
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
