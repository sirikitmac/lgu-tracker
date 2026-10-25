# BetterGov.ph project data: deployment and operations

## Sources

| `source` | Dataset (Hugging Face) | Records | Stored in | Weekly sync |
| --- | --- | --- | --- | --- |
| `dpwh_contracts` | `bettergovph/dpwh-transparency-data`, `dpwh_transparency_data_all_details.parquet` (CC0) | 248,421 contracts (snapshot 2026-01-16); **Visayas + Mindanao project locations stored by default** (108,486), see Storage | `dpwh_contracts` | `/api/cron/dpwh-sync`, Mon 02:00 PHT |
| `dpwh_nep_2027` | `bettergovph/dpwh-nep-2027`, `dpwh-nep-projects-2027.csv` (license not stated; NEP is a public government document) | 11,372 proposed DPWH projects, nationwide | `infrastructure_projects` | `/api/cron/bettergov-sync`, Mon 02:30 PHT |

Both snapshots are static between BetterGov.ph publishes; the app shows the
snapshot date and never presents the data as live. `public.project_directory`
lists every source in one view with a `source` column; the directory shows each
row's source and has a Source filter.

Reviewed but **not imported**:

* `bettergovph/philgeps-data` (`philgeps.parquet`, 5,481,161 procurement
  awards, of which 844,626 are "Construction Projects"). Too large for a
  500 MB database even before the DPWH contracts, no coordinates, and the
  `award_date` column decodes to future years (e.g. 2033–2034), so dates would
  need verification with BetterGov.ph first.
* `gaa`, `nep-2027` (whole-government budget lines, not projects),
  `bir-tax-collection`, `open-customs-data`, `project-noah-hazard-maps`,
  `senate-bills`, `raw-philippine-data`, `gov-library`, `creator`;
  `open-philippine-data` and `open-philgeps` contain no data files.

## Public routes (no sign-in)

| Route | What it shows |
| --- | --- |
| `/projects` | Searchable, filterable, sortable directory over every source (server-side pagination) |
| `/projects/map` | Map of DPWH contracts with DPWH-reported coordinates (viewport queries, max 1,500 markers per view, largest first). NEP proposals have no coordinates and are not mapped. |
| `/projects/<contract id>` | DPWH contract: every stored source field, document links, BetterGov record and dataset links |
| `/projects/source/<source>/<id>` | Other sources: normalized fields, the original source row, and dataset/snapshot links |

These routes read with the publishable key under RLS. Anonymous visitors can
read only `dpwh_contracts`, `dpwh_contracts_directory`, `dpwh_directory_stats`,
`infrastructure_projects`, and `project_directory`. Profiles, sync runs, LGU
reviews, the audit log, and the sync functions stay closed to them (covered by
`npm run test:db`).

The authenticated dashboard (`/dashboard`, `/dashboard/map`, `/dashboard/dpwh`)
is unchanged.

## 1. Apply the migrations (once, from a developer machine)

```sh
npx supabase login
npx supabase link --project-ref vveicrhbqzrdrfadynnp   # asks for the database password
npx supabase migration list                            # compare Local vs Remote first
npx supabase db push --dry-run                          # shows exactly which files would run
npx supabase db push                                    # applies only the pending ones
```

Do not run `supabase db reset` or `seed.sql` against this project.

## Storage requirement (check before importing)

A full local import of snapshot 2026-01-16 (248,421 contracts, all migrations
applied) measured **about 490 MB for `dpwh_contracts` (378 MB table + 112 MB
indexes)**; a sample on the hosted database measured ~1.64 KB of heap per row.
Supabase's Free plan caps the whole database at 500 MB and switches the project
to read-only when it is exceeded, so a nationwide import does not fit. (Rows are
~1.6 KB, below Postgres' 2 KB TOAST threshold, so column compression does not
help.)

The DPWH sync therefore stores a **region scope** (`src/lib/integrations/dpwh/nationwide/scope.ts`):

| Scope (project location) | Contracts (2026-01-16) | Estimated size |
| --- | --- | --- |
| Visayas + Mindanao (**default**) | 108,486 | ~230 MB |
| Mindanao only | 57,303 | ~120 MB |
| Nationwide (`all`, needs a paid plan) | 248,421 | ~490 MB |

Contracts outside the scope are counted per run (`out_of_scope_count`), never
stored, and never deleted if a wider run stored them earlier. Every DPWH slice
also checks the database size first and stops the run (status `failed`, rows
kept) at `SYNC_STORAGE_BUDGET_MB` (default 400). 6,806 contracts report no
location and are only stored by a nationwide run.

## 2. Initial import (once)

Put ONE of these in `.env.local` (never commit it, never prefix with `NEXT_PUBLIC_`):

* `SUPABASE_SECRET_KEY=sb_secret_...` (Supabase dashboard → Project Settings → API Keys), or
* `DPWH_SYNC_ADMIN_EMAIL` / `DPWH_SYNC_ADMIN_PASSWORD` of an active `super_admin` or `lgu_admin`.

```sh
npm run bettergov:sync              # dry run: downloads and validates the NEP 2027 file, no DB writes
npm run bettergov:sync -- --apply   # import NEP 2027 (~11k rows, under a minute; idempotent)

npm run dpwh:sync                   # dry run: validates the DPWH snapshot, writes exports/.../plan.json, no DB writes
npm run dpwh:sync -- --apply        # import DPWH contracts in the default scope; resumable and idempotent
npm run dpwh:sync -- --apply --regions "Region X,Region IX"   # another scope
```

If the DPWH import is interrupted, re-run the same command; it resumes the
running sync. Widening the scope later re-runs the same snapshot and inserts
only the newly in-scope contracts.

## 3. Vercel environment variables

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | all | `https://vveicrhbqzrdrfadynnp.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | all | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | Production, server only | Used only by the `/api/cron/*` sync routes. Never `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Production | Random, at least 16 characters (`openssl rand -hex 32`). Vercel Cron sends it as a bearer token. |
| `DPWH_SYNC_REGIONS` | Production, optional | Unset = Visayas + Mindanao; `all` = nationwide; or a comma-separated list of project regions. Must match what was imported, or the weekly run re-imports to the new scope. |
| `SYNC_STORAGE_BUDGET_MB` | Production, optional | Database size at which the DPWH sync stops (default 400; `off` disables). |

## 4. Weekly sync

`vercel.json` schedules `/api/cron/dpwh-sync` at `0 18 * * 0` (UTC), which is
**Monday 02:00 Asia/Manila**, and `/api/cron/bettergov-sync` (NEP 2027) at
`30 18 * * 0`, 30 minutes later. The NEP import runs the same way: skip an
already-imported snapshot, refuse one with under 90% of the last row count,
upsert by (source, ID) without deleting, and log every attempt in
`source_sync_runs`. Each DPWH run:

1. Asks the Hugging Face Hub which commit last changed the file. If that
   snapshot already synced successfully, it records `no_new_snapshot` and stops.
2. Refuses a snapshot whose row count is far below the last success, or whose
   contract IDs or slices are incomplete (incomplete download protection),
   before writing anything.
3. Upserts by DPWH contract ID in ordered batches. Unchanged rows are not
   rewritten, and nothing is deleted. LGU-entered fields live in
   `dpwh_contract_reviews`, which the sync never writes.
4. Records every attempt in `dpwh_sync_runs` (`succeeded`, `failed`,
   `no_new_snapshot`) with counts and errors, and refreshes
   `dpwh_directory_stats` on success.

Long runs pause before the function time limit and chain to themselves with the
run ID.

Check recent runs (as an admin, or in the SQL editor):

```sql
select status, trigger, source_revision, source_rows, scope_regions, inserted_count, updated_count,
       unchanged_count, rejected_count, out_of_scope_count, error, started_at, finished_at
from public.dpwh_sync_runs order by started_at desc limit 10;

select source, status, trigger, source_revision, source_rows, inserted_count, updated_count,
       unchanged_count, rejected_count, error, started_at, finished_at
from public.source_sync_runs order by started_at desc limit 10;
```

## Data notes

* About 214,700 of 248,421 contracts (snapshot 2026-01-16) carry coordinates.
  The rest appear in the directory but not on the map.
* The source has no city/municipality or barangay field, so that filter is shown
  as unavailable rather than guessed.
* Amounts are reported contract values, not disbursements.
* NEP 2027 rows are budget **proposals** (status "Proposed (budget)"), with the
  proposed amount, implementing office, program, and region only. The source has
  no province, municipality, or coordinates. Region abbreviations (NCR, CAR,
  NIR, MIMAROPA) are mapped to the DPWH region names so one filter covers both
  sources; two "Nationwide" programs have no region. The original CSV row is
  kept in `infrastructure_projects.source_record`.
