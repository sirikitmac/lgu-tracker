-- =============================================================================
-- LGU Tracker · Migration 13 · status_key: status filters the planner can estimate
-- =============================================================================
-- Fixes the rest of the rare-status timeouts. Migration 12's partial indexes
-- fixed the default sort, but with any other sort (amount, budget, progress,
-- start date or contract date ascending) a "Not yet started" filter still hit
-- the anon statement timeout (57014, 3 s).
--
-- Root cause: dpwh_contracts has row-level security, and the enum equality
-- operator is not leakproof, so for anon/authenticated requests the planner
-- may not use the status statistics and assumes 25% of rows match any status.
-- Believing a quarter of the table matches, it walks the sort column's index
-- and discards rows until it has a page, which for 98 matches is most of
-- ~92k rows. No index on status alone can change that estimate.
--
-- Text equality IS leakproof. public.dpwh_status_key() maps the enum to its
-- label with a CASE over the enum's own values (immutable, unlike
-- status::text, so it can be indexed); the expression index gives Postgres
-- statistics for it; and both directory views expose it as `status_key`,
-- which the app now filters on. Measured as anon on the hosted data, Not yet
-- started sorted by amount ascending: estimate 105 rows (actual 98), index
-- scan plus in-memory sort, 0.25 ms.
--
-- Changes:
--   - private.dpwh_status_key(dpwh_status): executable by anon,
--     authenticated and service_role only, like the other private helpers
--     (migration 4). Add a CASE branch here if dpwh_status gains a value.
--   - One expression index (status_key, amount desc, contract_id): stats
--     for the filter, and the default sort read in order.
--   - project_directory and dpwh_contracts_directory gain a trailing
--     status_key column. Existing columns, security_invoker and grants are
--     unchanged (create or replace keeps them).
--   - Drops migration 12's partial indexes: queries no longer filter on
--     status directly, so they would never be used.
-- No table, policy or RLS change.
-- =============================================================================

create function private.dpwh_status_key(s public.dpwh_status)
returns text
language sql
immutable
parallel safe
-- No `set search_path`: a SQL function with a SET clause is never inlined,
-- and inlining is what lets the planner match the index and use its
-- statistics. The body names no objects (the literals take the parameter's
-- schema-qualified type), so there is nothing for a search_path to resolve.
as $$
  select case s
    when 'completed' then 'completed'
    when 'ongoing' then 'ongoing'
    when 'for_procurement' then 'for_procurement'
    when 'not_yet_started' then 'not_yet_started'
    when 'terminated' then 'terminated'
    when 'unknown' then 'unknown'
    when 'proposed' then 'proposed'
  end
$$;
comment on function private.dpwh_status_key(public.dpwh_status) is
  'Status label as text, for filters: text equality is leakproof, so the planner can use statistics under RLS.';
revoke execute on function private.dpwh_status_key(public.dpwh_status) from public;
grant execute on function private.dpwh_status_key(public.dpwh_status) to anon, authenticated, service_role;

create index dpwh_contracts_status_key_amount_idx
  on public.dpwh_contracts (private.dpwh_status_key(status), contract_amount desc nulls last, contract_id);

create or replace view public.dpwh_contracts_directory
with (security_invoker = true)
as
select
  contract_id, title, contract_name, category, status, region, province, provinces, municipality,
  implementing_office, contractor, budget, contract_amount, progress, start_date, completion_date, infra_year,
  to_tsvector('simple'::regconfig,
    contract_id || ' ' || coalesce(title, '') || ' ' || coalesce(contract_name, '') || ' ' ||
    coalesce(contractor, '') || ' ' || coalesce(implementing_office, '')) as search,
  latitude, longitude, contract_effectivity_date,
  private.dpwh_status_key(status) as status_key
from public.dpwh_contracts;

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
  private.dpwh_status_key(status) as status_key
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
  private.dpwh_status_key(status)
from public.infrastructure_projects;

drop index if exists public.dpwh_contracts_terminated_amount_idx;
drop index if exists public.dpwh_contracts_not_yet_started_amount_idx;
drop index if exists public.dpwh_contracts_for_procurement_amount_idx;
drop index if exists public.dpwh_contracts_unknown_amount_idx;
drop index if exists public.dpwh_contracts_proposed_amount_idx;

analyze public.dpwh_contracts;
