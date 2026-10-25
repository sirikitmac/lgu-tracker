-- =============================================================================
-- LGU Tracker · Migration 7 · Public DPWH map and directory sorts
-- =============================================================================
-- Purely additive:
--   * dpwh_contracts_directory gains latitude, longitude and
--     contract_effectivity_date (appended, so CREATE OR REPLACE keeps the
--     existing columns, grants, and security_invoker setting).
--   * Indexes for the public map's bounding-box query and the location /
--     contract-date sorts.
-- No table, role, policy, grant, or function is changed. Public read access
-- to DPWH source data was already granted to anon in migration 6.
-- =============================================================================

create or replace view public.dpwh_contracts_directory
with (security_invoker = true)
as
select
  contract_id, title, contract_name, category, status, region, province, provinces, municipality,
  implementing_office, contractor, budget, contract_amount, progress, start_date, completion_date, infra_year,
  to_tsvector('simple'::regconfig,
    contract_id || ' ' || coalesce(title, '') || ' ' || coalesce(contract_name, '') || ' ' ||
    coalesce(contractor, '') || ' ' || coalesce(implementing_office, '')) as search,
  latitude, longitude, contract_effectivity_date
from public.dpwh_contracts;

-- Map viewport queries: latitude range first, longitude filtered within it.
create index dpwh_contracts_coordinates_idx on public.dpwh_contracts (latitude, longitude)
  where latitude is not null;
create index dpwh_contracts_location_sort_idx on public.dpwh_contracts (region, province);
create index dpwh_contracts_contract_date_idx on public.dpwh_contracts (contract_effectivity_date);
