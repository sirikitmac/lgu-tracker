-- =============================================================================
-- LGU Tracker · Migration 9 · Index for the default directory / map order
-- =============================================================================
-- Purely additive: one index, no data, table, policy, or grant change.
--
-- The directory (project_directory) and the map (dpwh_contracts_directory)
-- both order by contract_amount DESC NULLS LAST, then the row key. The
-- existing dpwh_contracts_contract_amount_idx is ascending (NULLS LAST), which
-- can only serve DESC NULLS FIRST, so Postgres scanned and sorted every
-- contract per request and anon requests hit the 3 s statement timeout once
-- ~90k contracts were stored. With this index the top N rows are read in
-- order straight from the index.
-- =============================================================================

create index dpwh_contracts_contract_amount_desc_idx
  on public.dpwh_contracts (contract_amount desc nulls last, contract_id);
