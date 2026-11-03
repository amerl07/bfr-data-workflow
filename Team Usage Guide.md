# BFR Aero Data Workflow — Team Guide
Last updated: November 3, 2026 - Yumo Liu

How to get your sim results into the shared database and find them again.
Full technical reference: https://github.com/amerl07/bfr-data-workflow.

# Quick Links
**Drop-off Folder**: https://drive.google.com/drive/folders/1XhrMoU9ermfWZocgzl05-cHdmZexGKih

**Process Queue Sheet**: https://docs.google.com/spreadsheets/d/1wsy2Wxk_wnQJ9HZp4YuSpW2W9VJ84CxjgcmKxb90JYQ/edit

**Web Database**: https://amerl07.github.io/bfr-data-workflow/

## 1. Workflow

1. **Name your job** using the convention in §2 *before* submitting. The
   name is how component, sweep type, owner and date get filled in, and it
   can't be fixed afterwards without re-uploading.
2. **Run your sim** on Sabalcore as usual. See https://docs.google.com/document/d/1hN6mHg-wJhHBhw11GJ4ZimBdNPMyy06pYu70YtxgMXE/edit?usp=sharing
3. **That's it for single runs.** Every few minutes a harvester uploads
   finished runs' `post.zip` to the drop-off folder, the pipeline detects
   it, parses the force report, uploads your scene images, and adds the run
   to the web app. STRAIGHTLINE runs also export field data, used by the
   Field Delta view (§4).
   - The harvester only takes job names ending in a `_YYYYMMDD` date on or
     after Sept 30, 2026. Otherwise, download `post_<job_name>.zip` from
     the relay app and drop it loose into the drop-off folder yourself.

**Running a sweep** (several sims, one parameter changing, e.g. mesh base
size 30/35/40mm): in the drop-off folder, create a plain Drive **folder**
named `{INITIALS}_{COMPONENT}_{SWEPTVARIABLE}_{SWEEPTYPE}_{YYYYMMDD}` and
put each run's `post_<job_name>.zip` inside it, with the value+unit at the
end of its DESCRIPTION:
```
YL_FC_MeshBase_Straight_20260913/                       <- the sweep folder
├── post_YL_FC_MeshBase30mm_Straight_20260913.zip
├── post_YL_FC_MeshBase35mm_Straight_20260913.zip
└── post_YL_FC_MeshBase40mm_Straight_20260913.zip
```
- `SWEPTVARIABLE` is the thing being varied (`MeshBase`), not a value.
- The folder gets **no** `post_` prefix and is **not** zipped.
- ⚠️ The harvester doesn't know about sweeps yet and uploads every run
  loose. If your sweep's zips were harvested before you grouped them, ping
  Yumo to regroup them.

The web app then shows them together as a batch. Full rules:
`CONTRIBUTING.md` §1b.

## 2. Naming convention

```
{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}
```
The `post.zip` is the same with `post_` in front, e.g.
`post_NC_UT_NoFillets_Cornering_20260724.zip`.

- All five fields, in order, separated by single underscores. No
  underscores or spaces *within* a field (`NoFillets`, not `No_Fillets`).
- **Initials**: fixed per person, see `CONTRIBUTING.md` §5.
- **Component**: `RW` (rear wing), `FW` (front wing), `UT` (undertray),
  `WSK` (whisker), `BW` (bodywork), `FC` (full car).
  - Parts of or attachments to a device use that device's code (e.g. `RW`
    for endplates, `FW` for footplates).
  - Use `FC` for sims that aren't iterating on one device (pitch sweeps,
    velocity sweeps, etc.).
- **Description**: free text, e.g. `NoFillets`, `Outwash`, `Baseline`.
- **Sweep type**: `CORNERING` or `STRAIGHTLINE`. (`VEL`, `YAW`, `RH`,
  `AOA`, `COMBO` aren't supported yet; use `FC` as above.)
- **Date**: `YYYYMMDD`.

Unknown codes won't break anything; they just show up as-is instead of as a
known category. Stick to the lists so filtering stays clean.

## 3. Checking status

Use the Processing Queue sheet to check whether your upload went through.
Each row's `status` moves through:

- `pending`: detected, waiting to be processed.
- `processing`: being worked on.
- `done`: in the database.
- `blocked: <reason>`: hit a known unsupported case.
- `error: <reason>`: something went wrong. Flag it to Yumo if the fix
  isn't obvious.

Detection takes about a minute, but processing runs every ~5 minutes, so a
row can sit at `pending` for a bit. If your run isn't on the web app yet,
check here first.

## 4. Using the web app

**https://amerl07.github.io/bfr-data-workflow/**. New `done` runs appear on
a page reload.

- **Explorer** (home): search and filter every sim (component, sweep type,
  owner, date, performance ranges), in card or table view, newest first by
  default. Star sims and filter to starred. Export results as CSV.
- **Simulation Detail**: full force breakdown, scene image gallery
  (searchable by name), raw data, source files, and a **Velocity slice
  roller** to step through slice images with zoom/pan.
- **Compare**: pick **two or more** sims and choose one as the baseline;
  all deltas are against it. Includes:
  - side-by-side metadata/performance with better/worse highlighted
  - scene galleries, and an image overlay to layer one image per sim
  - a slice roller stepping every sim's slices together
  - **Field Delta** (STRAIGHTLINE sims with field data): baseline, other
    sim, and difference heatmaps at one X position, with a slider for
    position and a picker for the field variable
- **Performance Explorer**: scatter plot across the whole database; pick
  the axes, color and marker size.
- **Analytics Dashboard**: team-wide stats, distributions, a correlation
  matrix, and leaderboards.

## 5. Questions, bugs, suggestions

Contact **Yumo Liu** (liuyumo@berkeley.edu / liuyumo422@gmail.com) about
stuck queue rows, bad parses, anything confusing in the web app, or ideas.
