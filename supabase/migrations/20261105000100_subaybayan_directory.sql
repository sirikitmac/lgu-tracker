-- =============================================================================
-- LGU Tracker · Migration 16 · DILG SubayBAYAN projects in the project directory
-- =============================================================================
-- Adds public.subaybayan_projects as a third arm of public.project_directory,
-- so /projects (grid and table) and the BP assistant list DILG projects next
-- to DPWH contracts and DPWH NEP 2027 proposals. Records stay in their own
-- tables; the view only reads them.
--
-- Additive:
--   - subaybayan_projects.total_cost_review (boolean, default false): the
--     total project cost is extreme for its subcategory and needs review.
--     Values are never changed; the flag only marks them. Rule (same as
--     scripts/subaybayan/lib/review.ts, which sets it on later imports):
--       total_cost >= greatest(P100,000,000, 100 x the median total_cost
--       (> 0) of the same sector_subcategory)
--     Backfilled below. 25 rows on the 2026-10-31 snapshot.
--   - Inlinable helpers (immutable SQL, no SET clause, like
--     private.dpwh_status_key) mapping DILG labels onto the directory's:
--     region "REGION X - NORTHERN MINDANAO" -> "Region X", province
--     "LANAO DEL NORTE" -> "Lanao del Norte".
--   - project_directory: same 24 columns, same order and types, then
--     appended: agency, sector_category, sector_subcategory,
--     location_precision, cost_adjusted, amount_needs_review, total_cost,
--     project_owner, project_code, barangay. security_invoker and grants are
--     kept (create or replace). DPWH rows get agency 'DPWH' and nulls/false.
--   - Two expression indexes on subaybayan_projects (search and the default
--     sort), so the DILG arm is read in order like the DPWH one.
--
-- DILG -> directory columns:
--   source        'subaybayan_lgsf' | 'subaybayan_rlip'
--   category      dpwh_category from sector_subcategory: Roads and bridges ->
--                 roads_highways; Water supply systems -> water_infrastructure;
--                 Public buildings, Markets and multipurpose buildings ->
--                 buildings_facilities; Disaster mitigation and preparedness ->
--                 flood_control_drainage; Other public infrastructure ->
--                 other_infrastructure; everything else -> uncategorized (the
--                 DILG grouping stays in sector_category / sector_subcategory)
--   status        completed / ongoing / not_yet_started as is,
--                 cancelled -> terminated, unknown -> unknown
--   contract_amount  total_cost, except NULL when total_cost_review, so the
--                 amount sorts (default: largest first) rank unverified
--                 totals after every verified one. The full value is always
--                 in total_cost.
--   budget        NULL (the "DPWH budget" sort stays DPWH-only)
--   progress      owpa (overall weighted physical accomplishment)
--   amount_label  'Total project cost'
--   latitude/longitude  area centroids (see location_precision), never a site
-- No policy, grant or RLS change; subaybayan_projects is already public read.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Data-quality flag
-- -----------------------------------------------------------------------------
alter table public.subaybayan_projects
  add column total_cost_review boolean not null default false;

comment on column public.subaybayan_projects.total_cost_review is
  'Total project cost is extreme for its subcategory (>= P100M and >= 100x the subcategory median) and needs review. The value is shown unchanged, marked "Amount not verified".';

with medians as (
  select sector_subcategory, percentile_cont(0.5) within group (order by total_cost) as median
  from public.subaybayan_projects
  where total_cost > 0
  group by sector_subcategory
)
update public.subaybayan_projects p
set total_cost_review = true
from medians m
where m.sector_subcategory is not distinct from p.sector_subcategory
  and p.total_cost >= greatest(100000000, 100 * m.median);

-- -----------------------------------------------------------------------------
-- Label helpers (inlinable: immutable SQL without SET, body names no objects)
-- -----------------------------------------------------------------------------
create function private.subaybayan_region_label(r text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when r is null then null
    when upper(r) = 'NATIONAL CAPITAL REGION' then 'National Capital Region'
    when upper(r) = 'CORDILLERA ADMINISTRATIVE REGION' then 'Cordillera Administrative Region'
    when upper(r) = 'NEGROS ISLAND REGION' then 'Negros Island Region'
    when upper(r) = 'MIMAROPA' then 'Region IV-B'
    when upper(r) like 'BANGSAMORO%' then 'Bangsamoro Autonomous Region in Muslim Mindanao'
    when upper(r) ~ '^REGION [IVX]+(-A)? ' then 'Region ' || substring(upper(r) from '^REGION ([IVX]+(?:-A)?) ')
    else r
  end
$$;
comment on function private.subaybayan_region_label(text) is
  'SubayBAYAN region label as the DPWH directory writes it ("REGION X - NORTHERN MINDANAO" -> "Region X").';

create function private.subaybayan_province_label(p text)
returns text
language sql
immutable
parallel safe
as $$
  select replace(replace(replace(initcap(p), ' Del ', ' del '), ' De ', ' de '), ' Of ', ' of ')
$$;
comment on function private.subaybayan_province_label(text) is
  'SubayBAYAN province in title case with Philippine particles lowercased ("LANAO DEL NORTE" -> "Lanao del Norte").';

revoke execute on function private.subaybayan_region_label(text), private.subaybayan_province_label(text) from public;
grant execute on function private.subaybayan_region_label(text), private.subaybayan_province_label(text)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Indexes for the DILG arm. Expressions match the view exactly.
-- -----------------------------------------------------------------------------
create index subaybayan_projects_search_idx on public.subaybayan_projects using gin (
  to_tsvector('simple'::regconfig,
    id || ' ' || coalesce(project_code, '') || ' ' || title || ' ' || coalesce(contractor, '') || ' ' ||
    coalesce(citymun, '') || ' ' || coalesce(barangay, '') || ' ' || coalesce(province, ''))
);

-- Default directory order: verified amount desc nulls last, then the row key.
create index subaybayan_projects_directory_amount_idx on public.subaybayan_projects (
  (case when total_cost_review then null else total_cost end) desc nulls last,
  ('subaybayan_' || source_dataset),
  id
);

-- Other directory sorts, so the planner merges the arms instead of sorting
-- every row (2 MB work_mem spills to disk; measured as anon on the hosted
-- data: "All" by progress 12 s -> 0.25 s, by amount ascending 1.3 s -> 19 ms;
-- DILG-only sorts ~0.55 s -> <1 ms). Reverse directions not listed here
-- (progress/start ascending, title/location Z-A) fall back to a sort of the
-- DILG arm, ~0.5 s: indexing them too would cost ~15 MB more.
create index subaybayan_projects_directory_amount_asc_idx on public.subaybayan_projects (
  (case when total_cost_review then null else total_cost end) asc nulls last, ('subaybayan_' || source_dataset), id);
create index subaybayan_projects_directory_progress_idx on public.subaybayan_projects (
  owpa desc nulls last, ('subaybayan_' || source_dataset), id);
create index subaybayan_projects_directory_start_idx on public.subaybayan_projects (
  start_date desc nulls last, ('subaybayan_' || source_dataset), id);
create index subaybayan_projects_directory_title_idx on public.subaybayan_projects (
  title asc nulls last, ('subaybayan_' || source_dataset), id);
create index subaybayan_projects_directory_location_idx on public.subaybayan_projects (
  private.subaybayan_region_label(region) asc nulls last, private.subaybayan_province_label(province) asc nulls last,
  ('subaybayan_' || source_dataset), id);

-- Directory filters on the DILG arm (each otherwise reads the whole table:
-- 32 MB of heap on a 224 MB buffer cache shared with dpwh_contracts).
create index subaybayan_projects_directory_source_idx on public.subaybayan_projects (('subaybayan_' || source_dataset));
create index subaybayan_projects_directory_region_idx on public.subaybayan_projects (private.subaybayan_region_label(region));
create index subaybayan_projects_directory_status_idx on public.subaybayan_projects ((
  case status when 'cancelled' then 'terminated' when 'completed' then 'completed' when 'ongoing' then 'ongoing'
    when 'not_yet_started' then 'not_yet_started' else 'unknown' end
));
create index subaybayan_projects_directory_category_idx on public.subaybayan_projects ((
  case sector_subcategory
    when 'Roads and bridges' then 'roads_highways'::public.dpwh_category
    when 'Water supply systems' then 'water_infrastructure'::public.dpwh_category
    when 'Public buildings' then 'buildings_facilities'::public.dpwh_category
    when 'Markets and multipurpose buildings' then 'buildings_facilities'::public.dpwh_category
    when 'Disaster mitigation and preparedness' then 'flood_control_drainage'::public.dpwh_category
    when 'Other public infrastructure' then 'other_infrastructure'::public.dpwh_category
    else 'uncategorized'::public.dpwh_category
  end
));

-- -----------------------------------------------------------------------------
-- project_directory with the DILG arm
-- -----------------------------------------------------------------------------
create or replace view public.project_directory
with (security_invoker = true)
as
select
  'dpwh_contracts'::text as source,
  contract_id as record_id,
  title, contract_name, category, status, region, province, provinces, municipality,
  implementing_office, contractor, budget, contract_amount, progress, start_date, completion_date, infra_year,
  to_tsvector('simple'::regconfig,
    contract_id || ' ' || coalesce(title, '') || ' ' || coalesce(contract_name, '') || ' ' ||
    coalesce(contractor, '') || ' ' || coalesce(implementing_office, '')) as search,
  latitude, longitude, contract_effectivity_date,
  'Contract amount'::text as amount_label,
  private.dpwh_status_key(status) as status_key,
  'DPWH'::text as agency,
  null::text as sector_category,
  null::text as sector_subcategory,
  null::text as location_precision,
  false as cost_adjusted,
  false as amount_needs_review,
  null::numeric as total_cost,
  null::text as project_owner,
  null::text as project_code,
  null::text as barangay
from public.dpwh_contracts
union all
select
  source,
  source_id,
  title, null::text, category, status, region, province,
  case when province is null then '{}'::text[] else array[province] end, municipality,
  implementing_office, null::text, amount, null::numeric, null::numeric, null::date, null::date, fiscal_year,
  to_tsvector('simple'::regconfig,
    source_id || ' ' || title || ' ' || coalesce(implementing_office, '') || ' ' || coalesce(program_name, '')),
  latitude, longitude, null::date,
  amount_label,
  private.dpwh_status_key(status),
  'DPWH'::text,
  null::text, null::text, null::text, false, false, null::numeric, null::text, null::text, null::text
from public.infrastructure_projects
union all
select
  'subaybayan_' || source_dataset,
  id,
  title,
  null::text,
  case sector_subcategory
    when 'Roads and bridges' then 'roads_highways'::public.dpwh_category
    when 'Water supply systems' then 'water_infrastructure'::public.dpwh_category
    when 'Public buildings' then 'buildings_facilities'::public.dpwh_category
    when 'Markets and multipurpose buildings' then 'buildings_facilities'::public.dpwh_category
    when 'Disaster mitigation and preparedness' then 'flood_control_drainage'::public.dpwh_category
    when 'Other public infrastructure' then 'other_infrastructure'::public.dpwh_category
    else 'uncategorized'::public.dpwh_category
  end,
  case status
    when 'completed' then 'completed'::public.dpwh_status
    when 'ongoing' then 'ongoing'::public.dpwh_status
    when 'not_yet_started' then 'not_yet_started'::public.dpwh_status
    when 'cancelled' then 'terminated'::public.dpwh_status
    else 'unknown'::public.dpwh_status
  end,
  private.subaybayan_region_label(region),
  private.subaybayan_province_label(province),
  case when province is null then '{}'::text[] else array[private.subaybayan_province_label(province)] end,
  citymun,
  null::text,
  contractor,
  null::numeric,
  case when total_cost_review then null else total_cost end,
  owpa,
  start_date,
  end_date,
  funding_year,
  to_tsvector('simple'::regconfig,
    id || ' ' || coalesce(project_code, '') || ' ' || title || ' ' || coalesce(contractor, '') || ' ' ||
    coalesce(citymun, '') || ' ' || coalesce(barangay, '') || ' ' || coalesce(province, '')),
  latitude, longitude, null::date,
  'Total project cost'::text,
  case status when 'cancelled' then 'terminated' when 'completed' then 'completed' when 'ongoing' then 'ongoing'
    when 'not_yet_started' then 'not_yet_started' else 'unknown' end,
  'DILG'::text,
  sector_category,
  sector_subcategory,
  location_precision,
  total_cost_basis is not null,
  total_cost_review,
  total_cost,
  project_owner,
  project_code,
  barangay
from public.subaybayan_projects;

comment on view public.project_directory is
  'All imported project records, one row per source record: DPWH contracts (dpwh_contracts), BetterGov.ph infrastructure_projects (dpwh_nep_2027) and DILG SubayBAYAN (subaybayan_lgsf, subaybayan_rlip). agency is DPWH or DILG.';

analyze public.subaybayan_projects;
