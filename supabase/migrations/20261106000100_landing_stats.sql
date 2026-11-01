-- Precomputed figures for the public landing page.
--
-- Why: the landing page read its numbers live, about thirty anon requests per
-- render: per-region "largest mapped contracts" scans, exact counts on
-- project_directory and subaybayan_projects, and an 18-step skip scan for the
-- distinct SubayBAYAN regions. Warm, the whole load takes ~3.5 s; the
-- smallest region (BARMM) alone takes ~1 s even with every page cached
-- (a bitmap heap scan over wide rows), so on a cold Free-plan instance single
-- queries cross the 3 s anon statement timeout and the coverage map or the
-- DILG figures fall back to "unavailable".
--
-- This adds one cached row, public.landing_stats, that the page reads with a
-- single primary-key lookup. private.refresh_landing_stats() rebuilds it:
--   * after every DPWH stats refresh (trigger on dpwh_directory_stats, which
--     refresh_dpwh_directory_stats() upserts when a sync succeeds), and
--   * from the SubayBAYAN import (public.refresh_landing_stats(), service role
--     or admin only), and once at the end of this migration.
-- The page keeps its live queries as a fallback for when this row is missing.
--
-- Contents of `stats`:
--   region_points:   [{region, points: [[lon, lat], ...]}], up to 300 per
--                    region, largest contract_amount first, coordinates
--                    rounded to 4 decimals (~11 m; the map draws 3.4 px dots)
--   nep_proposals:   FY 2027 NEP items stored
--   dilg_by_dataset: [{dataset, count}] for subaybayan_projects
--   dilg_regions:    distinct SubayBAYAN region labels
--
-- Size: ~3,000 points, ~70 kB of jsonb. Security: public read like
-- dpwh_directory_stats (everything in it is derived from public tables);
-- writes only through the SECURITY DEFINER refresh, empty search_path.

create table public.landing_stats (
  id          smallint primary key default 1 check (id = 1),
  computed_at timestamptz not null,
  stats       jsonb not null check (jsonb_typeof(stats) = 'object')
);

alter table public.landing_stats enable row level security;
revoke all on public.landing_stats from anon, authenticated;
grant select on public.landing_stats to anon, authenticated;
grant select, insert, update, delete on public.landing_stats to service_role;
create policy "landing stats: public read"
  on public.landing_stats for select to anon, authenticated using (true);

create or replace function private.refresh_landing_stats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stats jsonb;
begin
  select jsonb_build_object(
    'points_per_region', 300,
    'region_points', (
      select coalesce(jsonb_agg(jsonb_build_object('region', region, 'points', points) order by region), '[]')
        from (select region,
                     jsonb_agg(jsonb_build_array(round(longitude::numeric, 4), round(latitude::numeric, 4)) order by rn) points
                from (select region, latitude, longitude,
                             row_number() over (partition by region
                                                order by contract_amount desc nulls last, contract_id) rn
                        from public.dpwh_contracts
                       where region is not null and latitude is not null and longitude is not null) ranked
               where rn <= 300
               group by region) r
    ),
    'nep_proposals', (select count(*) from public.infrastructure_projects where source = 'dpwh_nep_2027'),
    'dilg_by_dataset', (
      select coalesce(jsonb_agg(jsonb_build_object('dataset', source_dataset, 'count', n) order by source_dataset), '[]')
        from (select source_dataset, count(*) n from public.subaybayan_projects group by source_dataset) s
    ),
    'dilg_regions', (
      select coalesce(jsonb_agg(region order by region), '[]')
        from (select distinct region from public.subaybayan_projects where region is not null) s
    )
  ) into v_stats;

  insert into public.landing_stats as l (id, computed_at, stats)
  values (1, now(), v_stats)
  on conflict (id) do update set computed_at = excluded.computed_at, stats = excluded.stats;
end;
$$;
revoke execute on function private.refresh_landing_stats() from public;

-- Rebuild whenever the DPWH directory stats are rebuilt (after a sync).
create or replace function private.landing_stats_after_dpwh_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_landing_stats();
  return null;
end;
$$;
revoke execute on function private.landing_stats_after_dpwh_stats() from public;

create trigger landing_stats_refresh
  after insert or update on public.dpwh_directory_stats
  for each statement execute function private.landing_stats_after_dpwh_stats();

-- For the SubayBAYAN import (and admins): same gate as the DPWH sync RPCs.
create or replace function public.refresh_landing_stats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can refresh the landing stats.' using errcode = '42501';
  end if;
  perform private.refresh_landing_stats();
end;
$$;
revoke execute on function public.refresh_landing_stats() from public, anon;
grant execute on function public.refresh_landing_stats() to authenticated, service_role;

select private.refresh_landing_stats();
