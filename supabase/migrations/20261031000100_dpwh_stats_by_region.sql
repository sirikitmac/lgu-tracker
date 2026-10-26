-- Adds per-region detail to the cached DPWH directory stats.
--
-- Why: the public dashboard (/projects/dashboard) lets visitors focus on one
-- region. The cached stats only had all-region status and category counts,
-- so with a region selected those figures could only be shown for all
-- regions. This redefines private.refresh_dpwh_directory_stats() to add a
-- `by_region_detail` array: per region, the contract count, summed reported
-- contract amount, contracts with an amount, and status and category counts.
--
-- Additive only: existing keys are unchanged, no table, policy, grant or RLS
-- change. The function keeps security definer, the empty search_path and the
-- revoke from public. Each breakdown is one grouped pass over dpwh_contracts,
-- run only when the stats are refreshed (after a sync), never per request.
--
-- Not applied automatically. After applying, the final statement refreshes
-- the cached row so the dashboard picks the detail up immediately.

create or replace function private.refresh_dpwh_directory_stats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last public.dpwh_sync_runs;
  v_stats jsonb;
begin
  select * into v_last from public.dpwh_sync_runs
   where status = 'succeeded' order by finished_at desc limit 1;

  select jsonb_build_object(
    'total_contracts', (select count(*) from public.dpwh_contracts),
    'contract_amount', (select jsonb_build_object('sum', coalesce(sum(contract_amount), 0), 'contracts_with_value', count(contract_amount))
                          from public.dpwh_contracts),
    'by_region', (select coalesce(jsonb_agg(jsonb_build_object('value', region, 'count', n) order by n desc), '[]')
                    from (select region, count(*) n from public.dpwh_contracts group by region) s),
    'by_category', (select coalesce(jsonb_agg(jsonb_build_object('value', category, 'count', n) order by n desc), '[]')
                      from (select category, count(*) n from public.dpwh_contracts group by category) s),
    'by_status', (select coalesce(jsonb_agg(jsonb_build_object('value', status, 'count', n) order by n desc), '[]')
                    from (select status, count(*) n from public.dpwh_contracts group by status) s),
    'provinces', (select coalesce(jsonb_agg(jsonb_build_object('region', region, 'province', province, 'count', n) order by region, province), '[]')
                    from (select c.region, p.province, count(*) n
                            from public.dpwh_contracts c, unnest(c.provinces) as p(province)
                           group by c.region, p.province) s),
    'municipalities', (select coalesce(jsonb_agg(jsonb_build_object('province', province, 'municipality', municipality, 'count', n) order by province, municipality), '[]')
                         from (select province, municipality, count(*) n from public.dpwh_contracts
                                where municipality is not null group by province, municipality) s),
    'offices', (select coalesce(jsonb_agg(jsonb_build_object('implementing_region', implementing_region, 'office', implementing_office, 'count', n)
                                          order by implementing_region, implementing_office), '[]')
                  from (select implementing_region, implementing_office, count(*) n from public.dpwh_contracts
                         where implementing_office is not null group by implementing_region, implementing_office) s),
    'infra_years', (select coalesce(jsonb_agg(jsonb_build_object('value', infra_year, 'count', n) order by infra_year), '[]')
                      from (select infra_year, count(*) n from public.dpwh_contracts group by infra_year) s),
    -- Per-region totals with their own status and category breakdowns, so the
    -- public dashboard can focus on one region without querying contract rows.
    'by_region_detail', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'region', r.region,
               'count', r.n,
               'amount_sum', r.amount_sum,
               'contracts_with_value', r.with_value,
               'by_status', coalesce(st.items, '[]'),
               'by_category', coalesce(ca.items, '[]')
             ) order by r.n desc), '[]')
        from (select region, count(*) n, coalesce(sum(contract_amount), 0) amount_sum, count(contract_amount) with_value
                from public.dpwh_contracts group by region) r
        left join (select region, jsonb_agg(jsonb_build_object('value', status, 'count', n) order by n desc) items
                     from (select region, status, count(*) n from public.dpwh_contracts group by region, status) s
                    group by region) st on st.region is not distinct from r.region
        left join (select region, jsonb_agg(jsonb_build_object('value', category, 'count', n) order by n desc) items
                     from (select region, category, count(*) n from public.dpwh_contracts group by region, category) s
                    group by region) ca on ca.region is not distinct from r.region
    )
  ) into v_stats;

  insert into public.dpwh_directory_stats as d (id, computed_at, last_successful_sync_at, source_revision, source_snapshot_at, stats)
  values (1, now(), v_last.finished_at, v_last.source_revision, v_last.source_snapshot_at, v_stats)
  on conflict (id) do update set
    computed_at = excluded.computed_at,
    last_successful_sync_at = excluded.last_successful_sync_at,
    source_revision = excluded.source_revision,
    source_snapshot_at = excluded.source_snapshot_at,
    stats = excluded.stats;
end;
$$;

-- Called only from the SECURITY DEFINER functions below (as their owner).
revoke execute on function private.can_run_dpwh_sync() from public;
revoke execute on function private.refresh_dpwh_directory_stats() from public;

select private.refresh_dpwh_directory_stats();
