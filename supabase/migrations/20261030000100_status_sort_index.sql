-- =============================================================================
-- LGU Tracker · Migration 10 · Index for status-filtered directory / map order
-- =============================================================================
-- Purely additive: one index, no data, table, policy, or grant change.
--
-- Filtering the directory or map by a rare status (Not yet started: 98
-- contracts; For procurement, Unknown, Proposed: 0 contracts) times out for
-- anon requests (57014, 3 s). Postgres reads dpwh_contracts in
-- contract_amount DESC order (migration 9's index) and discards rows until it
-- has a page, so a status with few or no contracts walks all ~92k rows.
-- With status leading, the filtered top N is one short index range read.
-- Expected size: a few MB at ~92k contracts.
-- =============================================================================

create index dpwh_contracts_status_amount_desc_idx
  on public.dpwh_contracts (status, contract_amount desc nulls last, contract_id);
