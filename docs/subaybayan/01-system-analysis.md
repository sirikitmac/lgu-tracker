# SubayBAYAN import · 01 · System analysis

Status: analysis only. No code, schema or data was changed. Written 2026-10-31 on branch
`feat/subaybayan-import` (created from `ada72b4`, the same commit as `main`).

Goal under analysis: add DILG SubayBAYAN project records (LGSF and RLIP lists, ~40k rows,
Excel, region/province/city/barangay but no coordinates) to LGU Tracker and show them on the
existing map with five category filters: Infrastructure, Community Development, Health &
Social Services, Environmental, Disaster Preparedness.

---

## 1. Stack

| Layer | What is used | Where |
|---|---|---|
| Framework | Next.js **16.4.3**, App Router, Turbopack build, React 19 | `package.json`, `src/app` |
| Language | TypeScript **7.0.2** (`strict`), path alias `@/* → src/*` | `tsconfig.json` |
| Styling | Tailwind CSS 4 (`@theme` tokens in CSS, no `tailwind.config`) | `src/app/globals.css` |
| Data | Supabase (Postgres + PostgREST + Auth) via `@supabase/supabase-js` 2.118 and `@supabase/ssr` 0.12 | `src/lib/supabase/*` |
| Map | Leaflet 1.9.4, OpenStreetMap tiles. No React wrapper (no react-leaflet), no clustering plugin | `src/components/dpwh/DpwhLeafletMap.tsx` |
| Other | `lucide-react` icons, `motion`, `@tanstack/react-table`, `hyparquet` (DPWH parquet), `@google/genai` (BP assistant) | |
| Hosting | Vercel; two weekly crons in `vercel.json` (`/api/cron/dpwh-sync`, `/api/cron/bettergov-sync`) | |
| Tests | `node:test` via `tsx` (87 unit tests); PGlite for DB tests (`npm run test:db`) | `tests/` |

Not present: ESLint (the `lint` script is `tsc --noEmit`), any Excel parser (`xlsx`/`exceljs`),
any geocoder or PSGC/barangay reference data (only `iligan-boundary.osm.json`).

Next.js 16 conventions in use: `src/proxy.ts` replaces `middleware.ts`; page props use the
global `PageProps<'/route'>` helper with `await params` / `await searchParams`.

## 2. Folder structure

```
src/
  app/
    page.tsx                         landing page (static, revalidate 1h)
    projects/                        PUBLIC section, no sign-in (layout: Navbar + Footer)
      page.tsx                       directory  (DpwhDirectory)
      map/page.tsx                   map        (DpwhPublicMap)
      dashboard/page.tsx             public stats
      [contractId]/page.tsx          DPWH contract detail
      source/[source]/[recordId]/    detail for non-contract sources (NEP today)
    dashboard/                       signed-in LGU dashboard (legacy Iligan sample-project UI)
      map/page.tsx                   IliganProjectMap over public.projects / sample data
    api/
      dpwh/{contracts,map,summary}   public JSON endpoints (anon key, RLS)
      cron/{dpwh-sync,bettergov-sync}  CRON_SECRET-protected sync jobs (maxDuration 300)
      admin/dpwh-sync, admin/dpwh-import/preview
      bp/chat, streetview
  components/
    dpwh/      public directory, map, cards, filters, detail, format helpers, ui.ts class tokens
    ui/        ConfirmDialog, StateViews (Skeleton/EmptyState/ErrorState/Notice), StatusBadge, Toast, Tooltip
    layout/    Navbar, Footer, ThemeToggle
    landing/, dashboard/, map/ (legacy), bp/
  lib/
    supabase/  env, browser, server, admin (service role), proxy, projectMapper
    integrations/dpwh/nationwide/  parquet source, normalize, categorize, query, sync, store
    integrations/bettergov/        Hugging Face hub client, NEP normalizer, generic source sync
    regionPalette.ts, statusPalette.ts, theme.ts, http.ts
  types/       dpwh.ts, infrastructureProject.ts, project.ts (legacy LGU model)
supabase/migrations/   13 migrations (see §4)
scripts/               dpwh-sync.ts, bettergov-sync.ts, dpwh-iligan-export.ts (CLI, tsx)
docs/                  DPWH_DEPLOYMENT.md, BP_ASSISTANT.md, subaybayan/ (this file)
```

## 3. Routing and data-fetching pattern

- **Server Components** for page shells; they parse `searchParams` and pass initial state.
  Detail pages query Supabase directly on the server (`createSupabaseServerClient()`).
- **Client Components** for the interactive directory and map. They call the app's own
  **Route Handlers** with `fetchJson` (`src/lib/http.ts`), never Supabase directly:
  - `GET /api/dpwh/contracts` → `project_directory` view (DPWH contracts ∪ `infrastructure_projects`)
  - `GET /api/dpwh/map?bbox=…` → `dpwh_contracts_directory` view, **DPWH contracts only**
  - `GET /api/dpwh/summary` → cached single-row `dpwh_directory_stats`
- Query building is centralised and validated in
  `src/lib/integrations/dpwh/nationwide/query.ts` (`parseDirectoryQuery`, `applyDirectoryFilters`,
  `applyMapFilters`, whitelisted `DPWH_SORTS`, `MAP_POINT_LIMIT = 1000`).
- Counts run as a separate `head: true` request because a combined count + ordered page
  exceeded the anon statement timeout.
- Writes (imports) go only through `SECURITY DEFINER` RPCs (`dpwh_sync_*`, `source_sync_*`),
  called from server routes / CLI scripts with the service-role key or an admin session.

## 4. Supabase

### Client setup

| File | Client | Key | RLS |
|---|---|---|---|
| `lib/supabase/env.ts` | shared config; refuses a secret key placed in a public var | — | — |
| `lib/supabase/browser.ts` | `createBrowserClient` singleton, cookie session | publishable/anon | yes |
| `lib/supabase/server.ts` | `createServerClient` per request, cookies | publishable/anon | yes |
| `lib/supabase/proxy.ts` + `src/proxy.ts` | session refresh on every request | publishable/anon | yes |
| `lib/supabase/admin.ts` | `createClient`, `server-only` | secret / service role | **bypasses** |

### Environment variable names (values not recorded)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`),
`CRON_SECRET`, `DPWH_SYNC_ADMIN_EMAIL`, `DPWH_SYNC_ADMIN_PASSWORD`, `DPWH_SYNC_REGIONS`,
`SYNC_STORAGE_BUDGET_MB`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`,
`GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`.
`.env.local` currently sets: Supabase URL, anon key, secret key, Gemini key.

### Tables (public schema)

Core LGU model (migrations 1–5, all RLS-enabled, role-aware policies; `projects` has **0 rows** live):
`organizations`, `organization_contacts`, `profiles`, `proposals`, `proposal_decisions`,
`projects`, `project_milestones`, `project_assignments`, `reports`, `comments`,
`project_status_history`, `attachments`, `audit_log`.

Imported public data (migrations 6–13):

| Object | Kind | Rows (live, 2026-10-31) | Access |
|---|---|---|---|
| `dpwh_contracts` | table | **92,581** | anon/auth SELECT (`using (true)`); writes only via `dpwh_sync_*` RPCs |
| `dpwh_contract_reviews` | table | — | staff read; reviewer roles insert/update |
| `dpwh_sync_runs` | table | — | admins read |
| `dpwh_directory_stats` | table (1 row) | 1 | public read |
| `infrastructure_projects` | table | **11,372** (all `source = 'dpwh_nep_2027'`) | public read; writes via `source_sync_*` |
| `source_sync_runs` | table | — | admins read |
| `dpwh_contracts_directory` | view, `security_invoker` | 92,581 | public read |
| `project_directory` | view (UNION ALL), `security_invoker` | **103,953** | public read |

Enums relevant here: `dpwh_category` (roads_highways, bridges, flood_control_drainage,
buildings_facilities, water_infrastructure, other_infrastructure, uncategorized),
`dpwh_status` (completed, ongoing, for_procurement, not_yet_started, terminated, unknown, proposed),
and the unused-by-imports `project_category` (4 values on `projects`).

RLS notes: every table has RLS on; Supabase default grants are revoked and re-granted
narrowly. The `private` schema (helpers, triggers) is not exposed. PostgREST `max_rows = 1000`
(`supabase/config.toml`). The anon statement timeout is 3 s (errors `57014` are documented in
migrations 9–13 and reproduced today, see §8).

### `dpwh_contracts` schema (57 columns; live row confirms the migration)

| Group | Columns |
|---|---|
| Key | `contract_id text PK` (regex-checked) |
| Names | `title`, `contract_name` |
| Category | `source_category`, `infra_type`, `category dpwh_category`, `category_method`, `category_reason` |
| Status | `source_status`, `status dpwh_status`, `procurement_status_code` |
| Office (not location) | `implementing_office`, `implementing_region` |
| Location | `region`, `province`, `provinces text[]`, `municipality`, `barangay`, `latitude`, `longitude` (both-or-neither check) |
| Parties | `contractor`, `winner_names` |
| Amounts | `budget`, `approved_budget`, `contract_amount`, `amount_paid` (numeric ≥ 0) |
| Progress/dates | `progress` (0–100), `start_date`, `completion_date`, `contract_effectivity_date`, `expiry_date`, `infra_year` |
| Funding/procurement | `program_name`, `source_of_funds`, `funding_instrument`, `advertisement_date`, `bid_submission_deadline`, `award_date`, 4 × `link_*` |
| Monitoring | `is_live`, `livestream_url`, `total_images`, `latest_image_date`, `source_verified_by_dpwh`, `source_verified_by_public` |
| Raw | `components jsonb[]`, `data_warnings text[]` |
| Provenance | `source_hash`, `source_revision` (40-hex), `source_snapshot_at`, `first_seen_run_id`, `last_changed_run_id`, `created_at`, `updated_at` |

Live data facts: 92,581 rows, all Visayas + Mindanao (10 regions; largest Region VIII 12,683).
86,982 have coordinates (94%). `municipality` is null on every row; `barangay` is null by design
(the source has neither). Categories: buildings 37,395 · roads 36,309 · flood 9,833 · bridges
5,704 · water 3,340. Statuses: completed 80,285 · ongoing 11,943 · terminated 255 · not yet started 98.
Stats were last computed 2026-10-26 and `last_successful_sync_at` is null (the import run was
stopped part-way and left resumable).

Indexes: GIN full-text expression, GIN `provinces`, b-tree on region, municipality (partial),
category, status, office, amounts, progress, dates, `(latitude, longitude)` partial,
`(contract_amount desc nulls last, contract_id)`, and
`(private.dpwh_status_key(status), contract_amount desc, contract_id)`.

`infrastructure_projects` (the generic "other source" table): `id uuid`, `source`, `source_id`
(unique together), `title`, `category dpwh_category`, `category_method`, `category_reason`,
`status dpwh_status`, `region`, `province`, `municipality`, `latitude`, `longitude`,
`implementing_office`, `program_name`, `sub_program`, `project_type`, `amount`, `amount_label`,
`fiscal_year`, `source_record jsonb` (original row), `data_warnings`, provenance columns.
**No `barangay` column.** `source_revision` must be a 40-hex string (a Git/Hub commit SHA).

## 5. Map

- **Library:** Leaflet 1.9.4 used imperatively in `src/components/dpwh/DpwhLeafletMap.tsx`,
  loaded with `next/dynamic({ ssr: false })` from `DpwhPublicMap.tsx` (page `/projects/map`).
- **Markers:** `L.circleMarker` on the canvas renderer (`preferCanvas: true`), radius 6, fill by
  status (`statusColor`) or region (`regionColor`), ring on hover/selected. Popups are HTML
  strings (escaped) with a link to `/projects/{contract_id}`. Markers are diffed by `contract_id`
  on each fetch so open popups survive panning.
- **Clustering:** none. Instead the viewport query returns at most **1,000** points, largest
  `contract_amount` first, plus the total, and the UI says "Largest N of M shown · zoom in".
- **Coordinates:** taken as reported (DPWH), validated by a DB check constraint; `parseBounds`
  validates the bbox (no antimeridian). Opening view is fixed to the Visayas–Mindanao bounds
  (`DATA_BOUNDS`). `?focus=&lat=&lng=` deep-links centre on one contract. Records without
  coordinates are excluded from the map and the page says so.
- **Related UI:** `DpwhMapProjectPanel` (list synced with markers, 50 per "Show more"),
  legend, Status/Region colour toggle, Street View cat (`StreetViewCat.tsx`).
- Legacy second map: `src/components/map/IliganProjectMap.tsx` on `/dashboard/map`, for the
  `projects` table / sample data. Not part of the public map.

## 6. Filters, categories, detail UI

- **Map filters** (`DpwhMapFilters.tsx`): text search, Region, Category, Reported status. State is
  local (not in the URL). Chips for active filters, "Clear all".
- **Directory filters** (`DpwhDirectory.tsx`, URL-backed): q, region, province, municipality,
  office, contractor, source, status, category, sort (14 options), page, pageSize, grid/list view.
- **Categories today:** the 7 `dpwh_category` values above (infrastructure work types), assigned
  deterministically by `categorize.ts` (source category → infra type → type of work → keywords).
  Labels in `DPWH_CATEGORY_LABELS`. Category photos per type in `public/categories/*`.
- **Detail UI:** `/projects/[contractId]` (DPWH: amount / progress / location tiles +
  `DpwhContractDetails` sections) and `/projects/source/[source]/[recordId]` (generic: header,
  project fields, data warnings, the original source row key-by-key, provenance links). A new
  source registered in `PROJECT_SOURCES` gets the generic page and directory listing for free.
  A drawer variant exists (`DpwhContractDrawer.tsx`).

## 7. Design tokens and reusable pieces

- Tokens in `globals.css` `@theme`: `ink`, `ink-soft`, `on-ink`, `subtle`, `muted`, `ground`,
  `surface`, `raised`, `sunken`, `line`, `line-strong`, `accent` (#FF7A1F), `accent-ink`,
  `accent-soft`, danger/warn soft/line/ink; `--radius-card` 1.125rem, `--radius-control`;
  `--shadow-raise`, `--shadow-float`; Public Sans + JetBrains Mono. Dark theme via
  `[data-theme="dark"]` overrides. Status colours in `lib/statusPalette.ts`, region colours in
  `lib/regionPalette.ts` (never the accent).
- Class helpers in `components/dpwh/ui.ts`: `panelClass`, `glassBarClass`, `controlClass`,
  `primaryButtonClass`, `accentButtonClass`, `secondaryButton{,Sm,Lg}Class`, `iconButtonClass`,
  `textLinkClass`.
- Components: `StateViews` (Skeleton, EmptyState, ErrorState, Notice), `Toast`/`useToast`,
  `Tooltip`, `ConfirmDialog`, `StatusPill`, `DpwhProjectCard`/`ProgressBar`, `DataFreshness`,
  `DataScopeNote`, `FilterSegment`/`FilterChip` (local to `DpwhMapFilters`).
- Formatting: `components/dpwh/format.ts` (`formatPeso`, `formatCount`, `formatDate`,
  `categoryLabel`, `statusLabel`, `warningLabel`, `readableTitle`).

## 8. Performance risks of ~40k more records

1. **No coordinates → stacked markers.** Placing records at municipality or barangay centroids
   puts many records on one exact point. Without clustering or per-place aggregation they are
   unclickable stacks and the 1,000-point cap (ordered by amount) hides most of them.
2. **Geocoding needs reference data the repo lacks.** Name matching to PSGC codes and centroids
   (≈1,650 cities/municipalities; ≈42,000 barangays) is a separate dataset and a real accuracy
   risk (spelling variants, "City of …", renamed barangays, BARMM/NIR changes).
3. **Anon 3 s statement timeout under RLS.** Already hit by rare filters (migrations 12–13) and
   still hit by non-default sorts. Reproduced today: `dpwh_contracts?barangay=not.is.null`
   returns `57014` (no index). Every new filter column needs an index, and enum filters need the
   `status_key` text trick, or they will time out.
4. **`project_directory` is a UNION ALL view.** Adding 40k rows to the second arm grows exact
   counts and cross-source sorts; the second arm has fewer indexes than `dpwh_contracts`
   (region, amount, coords, FTS only — no status/category/province indexes).
5. **Map endpoint is single-source.** `/api/dpwh/map` reads only `dpwh_contracts_directory` and
   orders by `contract_amount`. Mixing sources needs a new endpoint or a union with a common
   sort key; DILG amounts are a different concept from contract amounts.
6. **Storage on the Free plan (500 MB, sync guard at 400 MB).** Rough estimate for 40k rows with
   `source_record` jsonb plus indexes: 60–120 MB. Current DB size could not be read (see §10);
   it must be checked before import.
7. **Import path.** `source_sync_apply_batch` caps 2,000 records per call (≥ 20 calls for 40k),
   the generic sync assumes a Hugging Face snapshot with a 40-hex revision, and Vercel request
   bodies are capped at 4.5 MB, so an Excel upload through a route is not viable; a local CLI
   import (like `dpwh:sync`) is. An Excel parser dependency is needed.
8. **Cached stats are DPWH-only.** `refresh_dpwh_directory_stats()` scans `dpwh_contracts`;
   region/category options and the dashboard would not include DILG without new stats.

## 9. Integration options

### A. Reuse `infrastructure_projects` as two new sources (recommended)

Sources `dilg_subaybayan_lgsf` and `dilg_subaybayan_rlip`; add columns `barangay`, PSGC codes,
`theme` (the 5 new categories, as text + index, not an enum), `location_precision`
(`barangay` | `municipality` | `province` | `none`). Coordinates = PSGC centroid, flagged as
approximate. New map endpoint (or an extension) that returns DILG records **aggregated per place**
(one marker per municipality/barangay with a count, list on click), drawn as a separate layer
with its own legend; the 5 categories become a filter on that layer.

- Pros: reuses the import RPCs, run logging, `project_directory`, the generic detail page and
  provenance; the directory lists DILG immediately; smallest schema change.
- Cons: the table and union view widen; `source_revision` must be faked as a file SHA-1; the
  category model splits (7 DPWH work types vs 5 themes), so the map needs two category
  vocabularies or a mapping.

### B. Dedicated `dilg_projects` table + own endpoints and map layer

- Pros: schema fits SubayBAYAN fields exactly (program, barangay, physical/financial
  accomplishment, PSGC); no risk to the tuned DPWH queries; independent indexes and stats.
- Cons: duplicates sync RPCs, RLS, stats, detail page and directory wiring; directory needs a
  third union arm or a separate list; more code to maintain.

### C. Aggregate-only (no per-project markers)

Show DILG as counts per province/municipality (bubbles or choropleth) with a drill-down list
from the directory.

- Pros: honest about missing coordinates; tiny payload; no stacking problem; no barangay
  geocoding needed (municipality level is enough).
- Cons: no per-project pins; choropleth needs boundary geometry (MBs, licensing); less like
  "show it on the map with markers".

**Recommendation:** A for storage and directory, with C's per-place aggregation as the map
rendering. Geocode to municipality first (cheap, reliable), barangay later if a clean PSGC
barangay centroid source is chosen. Keep DPWH queries untouched.

## 10. Baseline (2026-10-31, branch `feat/subaybayan-import` at `ada72b4`)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | pass, 0 errors |
| Lint | `npm run lint` (= `tsc --noEmit`; no ESLint installed) | pass |
| Build | `npm run build` (Next 16.4.3, Turbopack) | pass; compiled 2.6 s; 20 static pages; 22 routes |
| Unit tests | `npm test` | 87 / 87 pass |
| DB tests | `npm run test:db` | not run |

Live checks were read-only with the public key. Reading the database size
(`sync_storage_usage`, needs the secret key) was blocked in this session, so the current size is
unknown.

## 11. Contradictions with the brief

1. **The SubayBAYAN URLs are not public.** Both `…/rbme/projects/index?type=lgsf` and `?type=rlip`
   answer `302 → /user/login`. The record count (~40k), the Excel format and "no lat/long" could
   not be verified; an exported file is needed, plus confirmation that the data may be republished.
2. **"Show it on the existing map" — the map only draws records with exact coordinates**, and
   only DPWH contracts (NEP records are already in the DB but not on the map). Without
   coordinates, DILG records need geocoding plus clustering or aggregation; there is no
   clustering today.
3. **"Existing category filters" — the categories that exist are 7 DPWH work types**, not the 5
   requested. "Infrastructure" would cover every DPWH contract, so the 5 themes overlap the
   current taxonomy rather than extending it. A third, unused set lives on `projects`.
4. **The data scope is Visayas + Mindanao** (Free-plan constraint); the map opens on those bounds.
   SubayBAYAN LGSF/RLIP is nationwide unless filtered the same way.
5. **There is no barangay data anywhere today** (`dpwh_contracts.barangay` is always null, and
   `infrastructure_projects` has no barangay column), and no PSGC reference to geocode against.
6. **"Lint" is only the TypeScript check**; ESLint is not installed.
7. **Branch:** the session started on `feat/dilg-dataset-integration` (no own commits, same tip as
   `main`), not `main`. `feat/subaybayan-import` was created from that same commit; `main` was not touched.
8. **RLIP is already a known label in the DPWH data:** `categorize.ts` treats `RLIP…` in DPWH's
   category field as a funding label. Worth checking whether some DILG RLIP projects also appear
   as DPWH contracts (duplicates across sources).
