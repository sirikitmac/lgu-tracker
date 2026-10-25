# DPWH nationwide data: deployment and operations

Source: BetterGov.ph's CC0 snapshot of the DPWH Transparency Portal
(Hugging Face dataset `bettergovph/dpwh-transparency-data`, file
`dpwh_transparency_data_all_details.parquet`). The snapshot is static between
BetterGov.ph publishes; the app shows the snapshot date and the last successful
sync, and never presents the data as live.

## Public routes (no sign-in)

| Route | What it shows |
| --- | --- |
| `/projects` | Searchable, filterable, sortable directory (server-side pagination) |
| `/projects/map` | Map of contracts with DPWH-reported coordinates (viewport queries, max 1,500 markers per view, largest first) |
| `/projects/<contract id>` | Every stored source field, document links, BetterGov record and dataset links |

These routes read with the publishable key under RLS. Anonymous visitors can
read only `dpwh_contracts`, `dpwh_contracts_directory`, and
`dpwh_directory_stats`. Profiles, sync runs, LGU reviews, the audit log, and the
sync functions stay closed to them (covered by `npm run test:db`).

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
indexes)**. Supabase's Free plan caps the whole database at 500 MB and switches
the project to read-only when it is exceeded. Confirm the project's plan and
current size (Dashboard → Project Settings → Usage) before running `--apply`.

## 2. Initial nationwide import (once)

Put ONE of these in `.env.local` (never commit it, never prefix with `NEXT_PUBLIC_`):

* `SUPABASE_SECRET_KEY=sb_secret_...` (Supabase dashboard → Project Settings → API Keys), or
* `DPWH_SYNC_ADMIN_EMAIL` / `DPWH_SYNC_ADMIN_PASSWORD` of an active `super_admin` or `lgu_admin`.

```sh
npm run dpwh:sync              # dry run: validates the snapshot, writes exports/.../plan.json, no DB writes
npm run dpwh:sync -- --apply   # import; resumable and idempotent (upsert by contract ID)
```

If it is interrupted, re-run the same command; it resumes the running sync.

## 3. Vercel environment variables

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | all | `https://vveicrhbqzrdrfadynnp.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | all | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | Production, server only | Used only by `/api/cron/dpwh-sync`. Never `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Production | Random, at least 16 characters (`openssl rand -hex 32`). Vercel Cron sends it as a bearer token. |

## 4. Weekly sync

`vercel.json` schedules `/api/cron/dpwh-sync` at `0 18 * * 0` (UTC), which is
**Monday 02:00 Asia/Manila**. Each run:

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
select status, trigger, source_revision, source_rows, inserted_count, updated_count,
       unchanged_count, rejected_count, error, started_at, finished_at
from public.dpwh_sync_runs order by started_at desc limit 10;
```

## Data notes

* About 214,700 of 248,421 contracts (snapshot 2026-01-16) carry coordinates.
  The rest appear in the directory but not on the map.
* The source has no city/municipality or barangay field, so that filter is shown
  as unavailable rather than guessed.
* Amounts are reported contract values, not disbursements.
