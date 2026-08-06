# BFR Simulations Database (web front-end)

Next.js static site that turns `../data/results.csv` into a searchable,
filterable, visualizable simulation database. Fetches the CSV live from
`raw.githubusercontent.com` at runtime (see `lib/data.ts`) -- no rebuild
needed when the ingestion pipeline commits new rows.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000. To point at a local/alternate dataset instead
of the live repo CSV during development:

```bash
NEXT_PUBLIC_DATA_URL=http://localhost:3000/some-fixture.csv npm run dev
```

### Drive API key

Scene Gallery hover labels (real Drive filenames, not just "Image N") need a
Drive API key at `NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY`. Without it, the gallery
silently falls back to positional labels -- this is optional, not required
to run the site.

To provision one:

1. GCP Console -> APIs & Services -> Credentials -> Create Credentials ->
   API key.
2. Restrict it: **API restrictions** -> Google Drive API only.
   **Application restrictions** -> HTTP referrers -> add
   `https://<username>.github.io/bfr-data-workflow/*` (and
   `http://localhost:3000/*` for local dev, or use a separate dev-only key).
3. This is a static export -- the key ends up in the public JS bundle
   regardless of how it's injected. The referrer restriction above is the
   actual protection, not keeping the key secret.
4. Only works for files shared "Anyone with the link" (same requirement
   already implied by the thumbnail/view links -- see `lib/drive.ts`).

For local dev, put it in `web/.env.local` (gitignored):

```bash
NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY=your-key-here
```

For deploys, add it as the repo secret `GOOGLE_DRIVE_API_KEY` (Settings ->
Secrets and variables -> Actions) -- `.github/workflows/deploy.yml` passes it
through to the build as `NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY`.

## Test

```bash
npm test        # vitest -- unit tests for lib/ (pure functions)
npx tsc --noEmit
npm run build    # static export sanity check
```

## Deploy

Handled by `../.github/workflows/deploy.yml` on push to `main` (path-filtered
to `web/**`), or via manual `workflow_dispatch`. Builds a static export
(`output: 'export'` in `next.config.ts`) with the `/bfr-data-workflow`
GitHub Pages base path, and publishes it via `actions/deploy-pages`.

**One-time setup required:** in the repo's GitHub Settings -> Pages, set
Source to "GitHub Actions" (not yet enabled as of this writing).

## Structure

- `lib/` -- CSV fetch/parse, filters, metrics, stats, colors (pure,
  unit-tested functions; no React).
- `hooks/` -- `useSimulations` (React Query wrapper around `lib/data.ts`),
  `useFilters` (URL-synced filter state), `useColorMode`.
- `components/ui/` -- small Radix-based primitives (shadcn/ui-style).
- `components/{explorer,detail,compare,performance,analytics}/` -- one
  directory per page.
- `app/` -- five routes: Explorer (`/`), Simulation Detail
  (`/simulation?job=`), Compare (`/compare?a=&b=`), Performance Explorer
  (`/performance`), Analytics Dashboard (`/analytics`). Page state (filters,
  selections, scatter axes) lives in the URL query string throughout, so
  every view is shareable via a plain link.
