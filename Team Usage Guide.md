# BFR Aero Data Workflow — Team Guide
Last updated: July 30, 2026 - Yumo Liu

This is the short version: how to get your sim results into the shared
database and how to find them again. For full technical reference see
https://github.com/amerl07/bfr-data-workflow.

# Quick Links
**Drop-off Folder**: https://drive.google.com/drive/folders/1XhrMoU9ermfWZocgzl05-cHdmZexGKih

**Process Queue Sheet**: https://docs.google.com/spreadsheets/d/1wsy2Wxk_wnQJ9HZp4YuSpW2W9VJ84CxjgcmKxb90JYQ/edit 

**Web Database**: https://amerl07.github.io/bfr-data-workflow/ 

## 1. Workflow

1. **Run your sim** on Sabalcore as usual. See https://docs.google.com/document/d/1hN6mHg-wJhHBhw11GJ4ZimBdNPMyy06pYu70YtxgMXE/edit?usp=sharing
2. **Name the job** using the naming convention below (see §2) — this
   matters since the job name is baked into the
   `post.zip` filename and that's how everything downstream (component,
   sweep type, owner, date) gets parsed out automatically. There's no way
   to fix it afterwards except uploading again with the right name.
3. **Drop `post_<job_name>.zip`** into the shared watched Drive folder:
   https://drive.google.com/drive/folders/1XhrMoU9ermfWZocgzl05-cHdmZexGKih
   You can drop it loose in that folder — no need to create a subfolder.
4. **Detection is automatic**, usually within about a minute. A row
   appears in the Processing Queue sheet (see §3) with status `pending`.
5. **Processing is also automatic** from there — it downloads your
   `post.zip`, parses the force report, and re-uploads your scene images
   so they're individually viewable. When it's done, the row's status
   flips to `done` and your run shows up in the database.
6. **Browse it** on the web app (see §4) — no manual step needed there
   either, it always reflects the latest data.

## 2. Naming convention
This is easiest if the convention is followed when you upload the sim to Sabalcore, as you won't be needing to change the name after the job finishes. If not, modify the name to follow the `post.zip` pattern below before you upload to drive.

Job names to Sabalcore follow one fixed pattern:

```
{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}
```

and the `post.zip` you upload just wraps that:

```
post_{INITIALS}_{COMPONENT}_{DESCRIPTION}_{SWEEPTYPE}_{YYYYMMDD}.zip
```

**Examples:**
```
post_NC_UT_NoFillets_Cornering_20260724.zip
post_YL_WSK_VariableAoA_Straightline_20260529.zip
```

**Rules of thumb:**
- All five fields are required, in that order, separated by single
  underscores — no underscores *within* a field (write `NoFillets`, not
  `No_Fillets`).
- **Initials** are fixed per person — see `CONTRIBUTING.md` §5 for the full
  registry.
- **Component** — one of: `RW` (rear wing), `FW` (front wing), `UT`
  (undertray), `WSK` (whisker), `BW` (bodywork), `FC` (full car). If the simulation is not for testing and iteration of one specific aero device (eg. pitch-angle sweeps, velocity sweeps, etc), use `FC`.
  - Note: If you are designing parts of or attachments to another device, use the component code of the main device. Eg. Use RW for endplates, FW for footplates, 
- **Description** — free text, your call, just NO UNDERSCORES or SPACES
  (e.g. `NoFillets`, `Outwash`, `Baseline`).
- **Sweep type** — one of: `CORNERING`, `STRAIGHTLINE`
  - NOT yet implemented: `VEL` (velocity), `YAW`, `RH` (ride height), `AOA` (angle of attack), `COMBO` (multi-parameter). Per the "Component" bullet, use FC component code instead.
- **Date** — `YYYYMMDD`.
- Unrecognized component/sweep-type codes won't break anything — they'll
  just show up as-is in the database instead of a "known" category. Still,
  try to stick to the lists above so filtering/grouping stays clean for
  everyone.

## 3. Checking status

The Processing Queue sheet is for checking "did my upload go through":
https://docs.google.com/spreadsheets/d/1wsy2Wxk_wnQJ9HZp4YuSpW2W9VJ84CxjgcmKxb90JYQ/edit

Each row's `status` column moves through:

- `pending` — detected, waiting to be processed.
- `processing` — actively being worked on.
- `done` — succeeded, should be in the database.
- `blocked: <reason>` — hit a known limitation (e.g. something not
  supported yet).
- `error: <reason>` — something went wrong. Check the reason, and flag it
  to Yumo if it's not obvious what to fix on your end.

**Known rough edge (being worked on):** status updates aren't instant. The
detection is quick (~1 min), but a row can sit at `pending` on the queue sheet for a while before actually being picked up and processed. If your run isn't showing up on the web app yet, check this sheet first before assuming something's broken.

## 4. Using the web app

Once your run is `done`, everything's queryable at:
**https://amerl07.github.io/bfr-data-workflow/**

Five sections, linked from the top nav bar:

- **Explorer** (home page) — search and filter every simulation (by
  component, sweep type, owner, date, performance ranges, etc.), in either
  a card or table view. Export whatever you've filtered down to as CSV.
- **Simulation Detail** — click into any run for its full force breakdown,
  scene image gallery, raw data, and source files.
- **Compare** — pick any two simulations and see a side-by-side diff of
  their metadata and performance, with better/worse highlighted.
- **Performance Explorer** — an interactive scatter plot across the whole
  database; pick what goes on each axis, color, and marker size.
- **Analytics Dashboard** — team-wide summary stats, distributions, a
  correlation matrix, and leaderboards (highest downforce, lowest drag,
  etc.).

The data refreshes on its own — you don't need to redeploy or refresh
anything for a new `done` run to show up, just reload the page.

## 5. Questions, bugs, suggestions

Direct all questions **Yumo Liu** (liuyumo@berkeley.edu). If something looks wrong (a stuck queue row, a bad parse, a confusing bit of the web app) or you have an idea for what'd make this more useful let me know.