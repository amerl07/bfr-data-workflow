
**Status:** Draft for implementation
**Owner:** Yumo
**Scope:** Rear wing + undertray development, current season

---

## 1. Problem Statement

- Team members run CFD sims independently (Sabalcore HPC or local STAR-CCM+) with no shared data repository.
- No consistent logging convention — existing data sheets vary sim-to-sim, person-to-person (see sample sweep sheet: raw Cd/Cl/Cl-Cd blocks, no version tags, no metadata).
- Bayesian optimization sweeps generate thousands of automated sims per batch; only 1–2 final candidates are ever manually reviewed. Per-sim manual logging is not feasible at this volume.
- Slide decks used for analysis/review contain plots and figures that never enter any shared record.
- Aerodynamic components are coupled (upstream devices affect downstream ones nonlinearly) — development happening in isolation risks incompatible or stale component combinations.
- No visibility between team members' work outside of weekly debriefs.

**Guiding principle:** component development order and inter-device interaction matter. Components should not be developed, tracked, or evaluated in complete isolation from each other.

---

## 2. Goals

1. Central, queryable record of every meaningful sim result — without adding manual data-entry burden.
2. Standard identification of *what* was tested (component, version, sweep type, owner, date) without forcing a rigid per-file format on raw outputs.
3. A lightweight reference tool for browsing/comparing component versions — explicitly **not** a tool for recomposing full-car performance from isolated runs.
4. A visual layer (scene images) tied to each version record.
5. A path toward flagging when a component's validation is stale relative to upstream changes.
6. (Future) Integration point for OptimumLap lap-time estimates once aero packages are finalized.

**Non-goals (explicitly out of scope for now):**
- Recomposing full-car CL/CD from independently toggled components (physically invalid — nonlinear component interaction).
- Reconstructing historical slide-deck data retroactively.
- Building CFD visualization tooling (that's STAR-CCM+'s job).

---

## 3. Current Workflow (as-is, for reference)

- CFD models built locally in STAR-CCM+.
- Sims submitted to Sabalcore HPC (or run locally for smaller cases).
- Sabalcore returns:
  - `post.zip` — scene PNGs + `force_reports.txt` (primary artifact for aero review)
  - `.sim` — full solution file, 5–10 GB, slow to download, only pulled when continuing a run or inspecting locally
- Bayesian optimization sweeps (tooling TBD — likely a custom Java macro) generate large batches of automated sims; only top candidates are manually reviewed.
- *[Reference: see supplementary Sabalcore workflow doc for full submission/download process.]*

---

## 4. Proposed Workflow (to-be)

### 4.1 Ingestion point: Google Drive, folder-level naming
- One folder per **batch/session** (not per individual sim file) — raw sim outputs (`post.zip` per run) dropped in unmodified, original filenames/order preserved.
- Folder name carries batch metadata using a fixed naming convention (see §5).
- Rationale: renaming or reorganizing thousands of individual sim outputs is infeasible and risks breaking correspondence with any existing manual records (e.g. legacy CSVs).

### 4.2 Automated parsing
- Script (Apps Script and/or Python) watches/scans the Drive structure.
- For each batch folder:
  - Parses folder name → component, version, sweep type, date, owner.
  - Unzips each `post.zip` inside, parses `force_reports.txt` → CL, CD, CoP, swept variable + range.
  - Extracts scene PNGs, stores alongside parsed results, indexed by version.
- Writes structured rows into a central database (SQL).
- `.sim` files are **not** ingested — only their storage location/owner is logged as a reference pointer, in case someone needs to reopen a run locally.

### 4.3 Bayesian sweep case (high volume)
- Full per-sim ingestion of thousands of runs is likely unnecessary and wasteful.
- If the sweep tool produces its own trials log (parameter set → objective value per iteration — common in most optimization frameworks and plausible even for a custom macro), ingest that log directly.
- Only the 1–2 selected final candidates get full `force_reports.txt` + scene image ingestion.
- Batch-level summary stats (range explored, best result found) logged instead of full sim-by-sim detail.
- **Open question:** confirm whether the current Bayesian sweep macro outputs any run log — determines feasibility of this approach.

### 4.4 Central database (SQL)
- One row per sim/version record, minimum fields:
  - Component, version, sweep type, date, owner (parsed from folder name)
  - Sweep variable + range, CL, CD, CoP (parsed from `force_reports.txt`)
  - Full-car vs. isolated-component flag
  - If full-car: which component versions were mounted together (coupling record)
  - Path/reference to scene images
  - Path/reference to `.sim` file (if retained)
  - `estimated_lap_time` / `optimumlap_run_id` — reserved, unpopulated for now
- Legacy manually-compiled sheets (e.g. current rear wing sweep CSV) treated as historical/frozen — not retroactively merged into the new schema to avoid corrupting existing row correspondence.

### 4.5 Reference/browsing dashboard
- Filterable view by component + version (and full-car combination where applicable).
- Displays parsed numeric results + associated scene image side by side.
- Explicitly framed as a **reference and intuition tool**, not a physics engine — no recomposition of isolated results into a predicted full-car number.
- Stretch: flag when a component's most recent full-car validation used an outdated version of an upstream/downstream component ("staleness" warning).

### 4.6 Slide deck problem
- Direction of data flow flipped: dashboard/database becomes the source of truth; slide decks pull figures *from* it rather than generating independent analysis.
- No retroactive extraction from existing decks planned (low ROI, fragile).

### 4.7 Future: OptimumLap integration
- Once an aero package is frozen for a given car build, log the corresponding OptimumLap run and estimated lap time against that build's component versions.
- Schema field reserved now; population deferred.

---

## 5. Naming Convention

```
{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}
```
Applied at the **batch folder** level, not to individual files inside.

**Examples:**
```
NC_UT_NoFillets_Cornering_20260724
YL_WSK_VariableAoA_Straightline_20260529
```

**Component codes:** RW (rear wing), FW (front wing), UT (undertray), WSK (whisker), BW (Bodywork)

**Sweep type codes:** CORNERING, STRAIGHTLINE, VEL (velocity), YAW, RH (ride height), AOA (angle of attack), COMBO (multi-parameter). Case-insensitive; the earlier CORNER/STRAIGHT codes (pre-2026-08-01) still parse as aliases of CORNERING/STRAIGHTLINE -- see `ingestion/parsers/sim_filename_parser.py`.

**Rules:**
- Absence of `FC` implies isolated-component run.
- Version bumps on any meaningful geometry change, however small.
- Initials fixed per person, documented centrally.
- Swept parameter ranges are *not* encoded in the name — pulled from `force_reports.txt` content instead. *(confirm this is present in the solver output before finalizing)*

---

## 6. Open Questions / Needs Investigation

- [ ] Does the Bayesian sweep macro output its own trials log? Format?
- [ ] Confirm `force_reports.txt` includes swept variable + range, not just CL/CD/CoP at each point.
- [ ] How do people currently organize their Sabalcore downloads in Drive, if at all — any existing partial convention to build from?
- [ ] Who has Sabalcore/Drive access broadly enough to support a shared watch-folder — one shared team login, or everyone individually?
- [ ] Confirm scope/intent of teammate's separately-mentioned "spreadsheet to parameterize things to change" — planning-input tool vs. results-logging tool. Determines whether it's complementary to this system or overlapping.
- [ ] Decide retention policy for `.sim` files (who hosts them, for how long).

---

## 7. Adoption Plan (social/organizational)

- Socialize this proposal with the team *before* building — confirm framing doesn't compete with or duplicate the teammate's spreadsheet idea.
- Backfill dashboard with a few weeks of existing results (parsed manually if needed) so the team sees the comparison view working before being asked to adopt the folder convention.
- Start with lowest-friction ask: one folder name per batch, not per-sim anything.
- Treat naming convention doc as a living pinned reference, not a one-time announcement.

---

## 8. Supplementary Materials (to be compiled)
- Sabalcore HPC submission/download workflow doc (existing, separate author) [[BFR Sabalcore HPC — Usage Guide]]
- Sample legacy sweep data sheet (rear wing, velocity sweeps) — reference only. You can see how inconsistent the format is. Goal is to find consistencies and existing patterns if possible.