# post.zip File Format Spec

**Purpose:** Reference for the future Drive-watcher/parser. Documents the file categories seen inside a `post_<job_name>.zip`, based on one observed batch. **Batches may vary** — different slice locations, missing/extra views, or file types not seen here are expected. This doc should be updated as new batches surface edge cases, not treated as a closed spec.

**Source file:** `PostDotZip_FileNames.txt` (one batch, 76 files)

---

## 0. Source File Naming (Sabalcore .sim / post.zip)

Before the categories below — this covers the *outer* file names, not the contents of post.zip.

**Sabalcore `.sim` naming:**
```
<INITIALS>_<descriptor>_<YYYYMMDD>.sim
```
- Prefix the `<descriptor>` with `ISO_` for isolated-part runs (e.g. `DY_ISO_RWv3_20260709.sim`).
- This matches the job naming convention in the Sabalcore Usage Guide (`<Initials>_<Description>_<YYYYMMDD>`), with the added detail that the `ISO_` marker is how isolated-component runs are flagged at the file-naming level.
- **Relationship to the Proposal Outline §5 convention:** the Drive batch-folder scheme (`{COMPONENT}_{VERSION}_{SWEEPTYPE}_{YYYYMMDD}_{INITIALS}`) already encodes isolated-vs-full-car via *absence of the `FC` component code*. The Sabalcore-level `ISO_` prefix is a second, independent signal for the same distinction, at a different naming layer. Worth deciding whether the parser should cross-check these two (job name says isolated, Drive folder name should agree) or treat the Sabalcore name as informal/pre-Drive and only trust the Drive folder convention as authoritative. Flagging as an open question rather than assuming.

**post.zip naming:**
```
post_<original .sim filename base>.zip
```
i.e. `post_<INITIALS>_<descriptor>_<YYYYMMDD>.zip` (or `post_<INITIALS>_ISO_<descriptor>_<YYYYMMDD>.zip` for isolated runs). Matches the `post_<job_name>.zip` pattern already documented in the Sabalcore Usage Guide.

---

## 1. Velocity Slices (`x_` / `y_` prefix)

Planar velocity scenes at fixed X or Y coordinates.

**Observed files:**
- Y-slices (negative): `y_-0.55`, `y_-0.45`, `y_-0.35`, `y_-0.8`, `y_-0.7`, `y_-0.6`, `y_-0.5`, `y_-0.4`, `y_-0.3`, `y_-0.2`, `y_-0.1`
- Y-slices (zero/positive): `y__0`, `y__0.55`, `y__0.45`, `y__0.35`, `y__0.8`, `y__0.7`, `y__0.6`, `y__0.5`, `y__0.4`, `y__0.3`, `y__0.2`, `y__0.1`
- X-slices: `x_0.0`, and `x__2.1` through `x__0.1` (21 files, 0.1 increments from -2.1 to -0.1)

**Naming pattern (⚠️ needs confirmation, see below):**
- `y_-<value>.png` — single underscore + explicit minus sign for negative Y values
- `y__<value>.png` — **double** underscore for zero and positive Y values (looks like a space or `+` got collapsed to `_`)
- `x_0.0.png` — single underscore for the zero X slice, with explicit `.0`
- `x__<value>.png` — double underscore used for **all** other X slices in this batch (all of which happen to be negative here)

**Open question:** it's unclear whether the double-underscore convention means "negative" (matches the X data, since all double-underscore X values are negative) or "zero/positive" (matches the Y data). These two interpretations contradict each other in this single batch. This needs to be confirmed against the STAR-CCM+ export macro directly rather than inferred from filenames — **do not hardcode a sign-parsing rule until this is confirmed.**

**Batch variability to expect:** slice locations (which X/Y values are exported) will differ per sweep/component — the parser should treat the numeric value as a variable field, not assume a fixed set of slices.

---

## 2. Wall Shear Stress (`WSS_` prefix)

8 files, one per face/quadrant combination:

```
WSS_{Surface}_{FrontBack}_{LeftRight}.png
```
- Surface: `Top`, `Bottom`
- Position: `Front`, `Back`
- Side: `Right`, `Left`

All 2×2×2 = 8 combinations present in this batch.

**Update from a later real batch:** a per-face overview shape also exists —
`WSS_{Top|Bottom|Right|Left|Front}.png` (5 files: `WSS_Top`, `WSS_Bottom`,
`WSS_Right`, `WSS_Left`, `WSS_Front`) — mirroring the overview/quadrant
split already documented for `CP_` below. Not present in this section's
original 76-file batch. This category is variable-count, not fixed, like
§1 and §3 — see `ingestion/parsers/post_zip_classifier.py`.

---

## 3. Pressure Coefficient (`CP_` prefix)

Most numerous category, with some inconsistency worth flagging:

**Per-face overview scenes:**
- `CP_Top`, `CP_Bottom`, `CP_Right`, `CP_Left`, `CP_Front`

**Per-face quadrant scenes** (Top/Bottom only, not Right/Left/Front):
```
CP_{Top|Bottom}_{Front|Back}_{Right|Left}.png
```
8 files: Top×(Front/Back)×(Right/Left), Bottom×(Front/Back)×(Right/Left)

**`_copy` variants:** `CP_Top_copy`, `CP_Right_copy`, `CP_Left_copy`, `CP_Front_copy`, `CP_Bottom_copy` — five files duplicating the per-face overview names above with a `_copy` suffix. **Unclear what distinguishes these from the non-copy version** (different camera angle, color scale, export artifact?) — flag for Dohyun/whoever owns the export macro.

**`CpT_Sweep.png`** — doesn't fit the per-face pattern above (no Top/Bottom/Front/Back/Left/Right qualifier). Possibly a summary/sweep plot rather than a single directional scene. Tentatively grouped here since it shares the `Cp` prefix, but flagged as distinct in kind from the rest of this category — confirm before parser treats it the same as the directional CP scenes.

---

## 4. Setup / Reference Scenes

Fixed, non-parametric reference images — not expected to vary in count batch-to-batch (though content will differ):
- `Vector_Scene_1.png`
- `Mesh.png`
- `Geometry.png`

---

## 5. Force Report

- `force_reports.txt` — primary numeric artifact. This is the one file that gets parsed into structured rows. A real sample arrived (docs/force_reports.txt) and confirmed the format: `# `-prefixed header comment lines (including a `run: <name>` identifier, a "half-car, undoubled" note, and a sign-convention note) followed by `<Label>  <value>  <unit>` rows. No CL/CD coefficients and no swept variable/range are present — see CONTRIBUTING.md §5/§6 for the full reasoning and the resulting `data/results.csv` schema.

---

## 6. Others / Unidentified

Nothing in this batch fell outside categories 1–5, aside from the two ambiguous items flagged above (`CpT_Sweep.png`'s odd-one-out naming, and the ambiguous `_` sign convention in category 1). This section exists as a catch-all for future batches — **anything encountered that doesn't cleanly fit categories 1–5 should be logged here with the batch it came from**, rather than force-fit into an existing category, so the parser's "unknown file" bucket has a paper trail instead of silently dropping files.

---

## 7. Target Output: One Row Per post.zip

Confirming the shape of what the parser produces, since this was still implicit. Each `post.zip` processed becomes **one row** in `data/results.csv` (or DB row later), with roughly:

| Field | Source |
|---|---|
| `job_name` / `sim_file_base` | Sabalcore `.sim` filename base (§0) — `<INITIALS>_<descriptor>_<YYYYMMDD>`, or `<INITIALS>_ISO_<descriptor>_<YYYYMMDD>` |
| `post_zip_name` | `post_<job_name>.zip` |
| `component` / `sim_type` | Parsed from descriptor / Drive batch folder name (Proposal Outline §5: RW, FW, UT, DIF, SP, FC) |
| `sweep_type` | VEL / YAW / RH / AOA / COMBO, from folder name |
| `isolated_vs_fullcar` | From `ISO_` prefix and/or absence of `FC` code — see the cross-check open question in §0 |
| `date` | `YYYYMMDD` from filename |
| `owner_initials` | From filename |
| `raw_force_values`, `CoP`, `CoP_meters` | Parsed from `force_reports.txt` (category 5) — updated after a real sample arrived (docs/force_reports.txt): the file has no CL/CD coefficients, only raw forces in Newtons plus two CoP representations. See CONTRIBUTING.md §5/§6 for the full reasoning. |
| `swept_variable`, `swept_range` | Confirmed **absent** from `force_reports.txt` (single-run export) — see CONTRIBUTING.md §6 |
| `scene_image_refs` | Pointers to the categorized images (categories 1–4) — see open question below on link vs. download |
| `source_drive_folder` | Path/link to the originating batch folder, for traceability |

This is a first pass — exact column names/order aren't locked, just the shape.

### Open question: image linking vs. downloading

Not yet decided, and it affects both the parser and the `.gitignore` setup:

- **Link only** (store a Drive file ID / shareable link per image in the CSV): simplest, no duplicate storage, but breaks if files get moved/deleted/permissions change, and means the datasheet is Drive-dependent.
- **Download a copy**: more durable, works offline, but needs its own storage location — **not the git repo** (consistent with the earlier `.gitignore` decision to keep `.sim`/`.zip`/image binaries out of version control). Would need a separate destination — e.g. a dedicated Drive "processed" folder, or local/cloud storage the CSV then points to.

Leaning toward "link only" as the simpler v1, with downloading as a fallback if Drive links prove unreliable — but flagging this as a decision to make explicitly before building the image-handling part of the parser, not something to default into.

---

## Notes for parser design

- Treat categories 1–3 (velocity slices, WSS, CP) as **variable-count, variable-parameter** — don't hardcode the exact slice values/quadrants seen in this one batch.
- Categories 4–5 (setup scenes, force report) are expected to be **fixed-count, always present**.
- Any file not matching a known pattern should route to an "unclassified" bucket (category 6) and get logged with filename + batch folder name, rather than causing a silent skip or a parser failure.
- Before finalizing the sign/zero-value naming rule for X/Y slices, confirm directly against the export macro rather than reverse-engineering from filenames — the one batch we have contains a contradiction (see §1).
- The parser that maps a Drive batch folder to its source Sabalcore job should be aware of both naming layers (§0) — the folder name convention and the underlying `.sim`/`post.zip` name won't necessarily agree on how "isolated" is flagged (`FC` absence vs. `ISO_` prefix). Decide whether to cross-validate or pick one as authoritative before building this mapping.
