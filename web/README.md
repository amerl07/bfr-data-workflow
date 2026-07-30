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
