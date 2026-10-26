-- =============================================================================
-- LGU Tracker · Migration 12 · Partial indexes for rare-status filters
-- =============================================================================
-- Fixes: filtering the directory or map by a rare status (Terminated: 255
-- contracts, Not yet started: 98, For procurement / Unknown / Proposed: 0)
-- returned 502 for public requests: the anon statement timeout (57014, 3 s)
-- was hit, intermittently, depending on what was cached.
--
-- Root cause: dpwh_contracts has row-level security, and the enum equality
-- operator is not leakproof, so for anon/authenticated requests the planner
-- may not use the status column's statistics and assumes 25% of rows match
-- any status. It then reads contracts in contract_amount order and discards
-- non-matching rows until it has a page; for a status with few or no
-- contracts that walks all ~92k rows. Migration 10's (status, amount) index
-- did not help: with the same wrong estimate the planner never picks it.
--
-- A partial index needs no column statistics: the planner proves
-- "status = X" matches the index predicate and costs the index by its own
-- size, so it reads the matching rows directly, already in amount order.
-- Measured as anon on the hosted data (Not yet started, page of 25):
-- 2 index pages instead of ~10k heap pages, 3.7 ms warm.
--
-- One index per status except Completed and On-going, which are common
-- enough that the amount-ordered scan finds a page at once. Each index holds
-- only that status's rows, so all five together are a few hundred kB.
--
-- No table, view, policy, grant or RLS change; app queries are unchanged.
-- =============================================================================

create index dpwh_contracts_terminated_amount_idx
  on public.dpwh_contracts (contract_amount desc nulls last, contract_id)
  where status = 'terminated';

create index dpwh_contracts_not_yet_started_amount_idx
  on public.dpwh_contracts (contract_amount desc nulls last, contract_id)
  where status = 'not_yet_started';

create index dpwh_contracts_for_procurement_amount_idx
  on public.dpwh_contracts (contract_amount desc nulls last, contract_id)
  where status = 'for_procurement';

create index dpwh_contracts_unknown_amount_idx
  on public.dpwh_contracts (contract_amount desc nulls last, contract_id)
  where status = 'unknown';

-- 'proposed' is only ever set on NEP budget items, never on contracts, but the
-- directory's union view still asks dpwh_contracts for it; the empty index
-- answers that in one page read instead of a full walk.
create index dpwh_contracts_proposed_amount_idx
  on public.dpwh_contracts (contract_amount desc nulls last, contract_id)
  where status = 'proposed';

-- Superseded by the indexes above and never chosen for public requests (see
-- the root cause). Dropping it frees its space on the Free plan.
drop index if exists public.dpwh_contracts_status_amount_desc_idx;

analyze public.dpwh_contracts;
