-- =============================================================================
-- SubayBAYAN: keep the source's reported total when it was not used as total_cost.
--
-- The pipeline skips a reported total project cost that is over 20x the row's
-- own contract amount or national subsidy + LGU counterpart (decimal-entry
-- errors such as P1,994,699,780 against a P2,000,000 subsidy) and uses that
-- amount instead. These columns keep what the source said, so the substitution
-- is visible and reversible:
--   total_cost_reported  the total project cost exactly as reported (pesos)
--   total_cost_basis     which amount total_cost holds instead
-- Both are null when total_cost is the reported total (or nothing was replaced).
--
-- Additive only: two nullable columns on public.subaybayan_projects. RLS,
-- grants and policies are unchanged (table-level public read already covers them).
-- =============================================================================

alter table public.subaybayan_projects
  add column total_cost_reported numeric(16, 2) check (total_cost_reported >= 0),
  add column total_cost_basis    text check (total_cost_basis in ('contract_amount', 'subsidy_plus_counterpart'));

alter table public.subaybayan_projects
  add constraint subaybayan_projects_cost_basis_check
  check ((total_cost_reported is null) = (total_cost_basis is null));

comment on column public.subaybayan_projects.total_cost_reported is
  'Total project cost as reported by SubayBAYAN when it looked like a data-entry error and was not used as total_cost.';
comment on column public.subaybayan_projects.total_cost_basis is
  'Which amount total_cost holds instead of the reported total: contract_amount or subsidy_plus_counterpart.';
