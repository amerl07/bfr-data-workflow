# Architecture Diagram Brief — BFR Aero CFD Data Pipeline

Instructions for building an architecture diagram of this system for a
portfolio HTML page. Written to be handed to a designer, a front-end
build, or an AI page generator as-is.

---

## 1. What the diagram has to show

**One-sentence story:** CFD simulation results from an HPC cluster flow
automatically, without a backend server, into a searchable web database
that the team uses.
Most of the "glue" is free managed services (Apps Script, a Google Sheet
used as a queue, GitHub Actions, GitHub Pages).

The viewer should come away with three things:
1. **End-to-end automation.** Simulation finishes, then the result shows up on the
   website with no human in the loop.
2. **No servers to run.** Every stage runs on a different free/managed platform.
3. **Engineering judgment.** A few annotated decisions (polling instead of
   push, external cron instead of GitHub schedule, OAuth instead of a
   service account, CSV in git instead of a database) show the trade-offs I made.

---

## 2. Layout

A **left-to-right flow** with **5 vertical swimlanes**, one per hosting
platform. Each lane is a tinted rounded rectangle with the platform name as
its header. Nodes sit inside their lane.

```
┌─────────────┐  ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐  ┌────────────────┐
│ 1. HPC      │  │ 2. Google        │  │ 3. GitHub     │  │ 4. GitHub Repo   │  │ 5. Browser     │
│ (Sabalcore) │  │    Workspace     │  │    Actions    │  │                  │  │ (GitHub Pages) │
└─────────────┘  └──────────────────┘  └───────────────┘  └──────────────────┘  └────────────────┘
```

On mobile (< 720px), stack the lanes **top-to-bottom** and turn the arrows
downward. Don't use a horizontally scrolling diagram.

---

## 3. Nodes

Use a short title, a one-line subtitle, and a small tech tag/chip.

### Lane 1: HPC Cluster (Sabalcore)
| ID | Title | Subtitle | Tech chip |
|---|---|---|---|
| `hpc` | CFD Simulation Runs | STAR-CCM+ jobs on PBS scheduler write `post_<job>.zip` | PBS · HPC |

### Lane 2: Google Workspace
| ID | Title | Subtitle | Tech chip |
|---|---|---|---|
| `drive` | Watched Drive Folder | Landing zone for post.zip outputs (also accepts manual drops) | Google Drive |
| `watcher` | Drive Watcher | Polls Drive Changes API every 1 min, filters new post jobs | Apps Script · Drive API v3 |
| `queue` | Processing Queue | Google Sheet used as a lightweight job queue (status per row) | Google Sheets |
| `images` | Extracted Scene Images | Unzipped images re-uploaded as individually linkable files | Google Drive |

### Lane 3: GitHub Actions (CI runner)
| ID | Title | Subtitle | Tech chip |
|---|---|---|---|
| `cron` | External Cron | Fires `workflow_dispatch` every 5 min | cron-job.org · GitHub REST API |
| `harvest` | Harvester Job | SSH/SFTP into HPC, uploads only *finished* runs (max 5/run) | Python · paramiko |
| `consume` | Queue Consumer Job | Downloads, unzips, parses force reports, writes rows | Python · Drive/Sheets API |
| `deploy` | Deploy Job | Builds static site on `web/**` changes | Next.js static export |

Put `cron` slightly above or outside the lane (it's an external service
triggering the lane). Use a dashed border.

### Lane 4: GitHub Repo
| ID | Title | Subtitle | Tech chip |
|---|---|---|---|
| `csv` | `results.csv` | Source of truth: one row per simulation, ~60 columns, versioned in git | CSV · git |

### Lane 5: Web App (browser)
| ID | Title | Subtitle | Tech chip |
|---|---|---|---|
| `site` | BFR Simulations Database | Explorer · Detail · Compare · Performance · Analytics | Next.js · React · TanStack Query |

Optional: render `site` as a mini browser window with the 5 page names as
tabs, or as five stacked pills.

---

## 4. Edges (arrows)

Number the main data path with step badges so the path can be read in order.
Solid arrows show **data**. Dashed arrows show **triggers/control**.

| # | From → To | Label | Style |
|---|---|---|---|
| 1 | `hpc` → `harvest` | finished runs (zip + PBS log present) | solid |
| 2 | `harvest` → `drive` | resumable upload | solid |
| 3 | `drive` → `watcher` | change feed (poll, 1 min) | solid |
| 4 | `watcher` → `queue` | enqueue job row | solid |
| 5 | `queue` → `consume` | read pending rows | solid |
| 6 | `drive` → `consume` | download post.zip | solid |
| 7 | `consume` → `images` | upload extracted images | solid |
| 8 | `consume` → `csv` | commit new rows | solid, **highlight color** |
| 9 | `csv` → `site` | fetched live at runtime (no rebuild) | solid, **highlight color** |
| 10 | `images` → `site` | thumbnails via Drive links / API | solid, thin |
| — | `cron` → `harvest`, `consume` | triggers | dashed |
| — | `consume` → `queue` | mark done / error | dashed, thin |
| — | `deploy` → `site` | publishes static build | dashed |

Edge 9 is the most important visual point. Data updates don't redeploy the site.
Give it a callout (see §5).

---

## 5. Design-decision callouts

Add 4–5 small numbered "ⓘ" markers on the diagram. Hovering (desktop) or
tapping (mobile) a marker opens a short card. If there's no
interactivity, list them as a numbered legend below the diagram.

1. **On `watcher`: Polling over push.**
   The Drive push notifications (`changes.watch` webhook) were built but
   never fired reliably. A 1-minute poll of the Changes API is boring and dependable.
2. **On `cron`: External cron over GitHub `schedule:`.**
   GitHub's native scheduler showed 1.5–3 hour gaps against a 5-minute
   setting. An external service hitting `workflow_dispatch` starts runs
   within seconds. A shared concurrency group keeps overlapping runs from racing.
3. **On `consume`: OAuth user credentials over a service account.**
   Service accounts have no Drive storage quota outside a Shared Drive,
   and the university Workspace doesn't allow creating one. Real-user OAuth
   with a refresh token stored as a CI secret was the workable path.
4. **On `csv`: A CSV in git as the database.**
   It's versioned, diffable, and needs zero infrastructure. Migrating to hosted Postgres
   is deferred until row volume or concurrent writes actually require it.
5. **On `harvest`: Safe "finished" detection.**
   A run only counts as done when both the zip *and* the PBS stdout log
   exist (PBS writes the log last), so a half-written zip is never
   uploaded. The harvester is read-only on the cluster and idempotent
   against the queue and CSV.

---

## 6. Visual style

- **Lane tints** use one soft hue per platform. Avoid official brand logos and colors;
  use generic icons (server, folder, gear/clock, table, git branch,
  browser window). Lucide or Heroicons inline SVGs work well.
- **Nodes:** white/surface cards, 1px border, 8px radius, subtle shadow.
  Title 14–15px semibold, subtitle 12–13px muted, chip 11px monospace.
- **Arrows:** 1.5px, rounded joins, small arrowheads. Use the accent color on edges 8
  and 9 and neutral gray on the rest. Step badges should be small filled circles with
  white numerals.
- **Dark mode:** define colors as CSS custom properties and swap them under
  `prefers-color-scheme: dark`.
- **Font:** one sans (e.g. Inter) plus one mono (e.g. JetBrains Mono) for
  chips and filenames.

---

## 7. Interactivity (optional)

- **Animated flow:** a dot travels along edges 1→9 in order on page load
  (or on a "▶ Play" button). Respect `prefers-reduced-motion` by showing a static
  diagram.
- **Hover a node** to highlight its incoming and outgoing edges and dim everything else.
- **Step-through mode:** "Next" walks through steps 1–9 and shows a caption under the
  diagram for each, for example "③ Apps Script polls Drive's change feed every
  minute and filters for new `post_*.zip` files."

Build approach: inline SVG for edges plus absolutely positioned HTML cards,
or a library like React Flow / Mermaid if the portfolio already uses one.
A hand-built SVG gives the most control over the look.

---

## 8. Supporting copy around the diagram

**Headline:** From HPC to dashboard, fully automated

**Intro (2 sentences):** Berkeley Formula Racing's aero team ran hundreds
of CFD simulations whose results lived in scattered spreadsheets. I built
a serverless pipeline that pulls each finished run off the HPC cluster,
parses its force reports, and publishes it to a searchable web database
within minutes.

**Stat strip under the diagram** (update numbers before publishing):
- 5 platforms, 0 servers to maintain
- ~1 min detection latency, ≤5 min end-to-end trigger cadence
- ~60 parsed fields per simulation
- 5 analysis views (Explorer, Detail, Compare, Performance, Analytics)

**Tech stack row:** Python · Google Apps Script · Drive & Sheets APIs ·
GitHub Actions · Next.js · TypeScript · React · Tailwind

---

## 9. Leave out of the public version

- Drive folder IDs, spreadsheet IDs, the HPC account/username, host
  names, the PAT name, and any email addresses
- Secret names (`GOOGLE_OAUTH_TOKEN_JSON`, etc.). Say "stored as CI secret"
  instead.
- The unused push-notification path. It's mentioned only in callout 1, not
  drawn as nodes, so the diagram stays clean.
- The folder-name parser stub and the batch/sweep-folder TODO
