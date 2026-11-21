-- =============================================================================
-- LGU Tracker · Migration · Map bubbles (project counts per area)
-- =============================================================================
-- The public map shows one bubble per area (sized by how many projects it
-- holds, coloured by region, with the status breakdown on hover) instead of
-- thousands of markers. The browser then receives at most a few hundred rows,
-- which is also what stops the map from timing out.
--
-- Purely additive. One small table, two functions, one trigger:
--   * public.dpwh_map_cells      : mapped contracts counted per grid cell at
--                                  three zoom levels (1 degree, 0.25, 0.05),
--                                  per region / category / status. It holds
--                                  counts and coordinate sums only, no contract
--                                  data, and is readable by everyone like the
--                                  contracts themselves.
--   * private.refresh_dpwh_map_cells() : rebuilds it in one transaction
--                                  (readers keep seeing the old rows until the
--                                  commit). Runs after every successful sync via
--                                  a trigger on dpwh_directory_stats, which the
--                                  sync already refreshes. A failure there is
--                                  logged as a warning and never fails a sync.
--   * public.dpwh_map_bubbles()  : the viewport query the API calls.
-- Because the table has no row-level-security filter on contracts to plan
-- around, it is also fast for anonymous requests on a nearly full database.
-- Manual rebuild (SQL editor):  select private.refresh_dpwh_map_cells();
-- =============================================================================

create table public.dpwh_map_cells (
  level      smallint         not null check (level between 0 and 2),
  cell_lat   integer          not null,
  cell_lng   integer          not null,
  region     text             not null,  -- '' when the contract reports no region
  category   text             not null,
  status_key text             not null,
  n          integer          not null check (n > 0),
  sum_lat    double precision not null,
  sum_lng    double precision not null,
  primary key (level, cell_lat, cell_lng, region, category, status_key)
);
comment on table public.dpwh_map_cells is
  'Mapped DPWH contracts counted per grid cell (level 0 = 1 degree, 1 = 0.25, 2 = 0.05) and region/category/status. Rebuilt after each sync.';

alter table public.dpwh_map_cells enable row level security;
create policy dpwh_map_cells_read on public.dpwh_map_cells for select to anon, authenticated using (true);
revoke all on public.dpwh_map_cells from public, anon, authenticated;
grant select on public.dpwh_map_cells to anon, authenticated;

create function private.refresh_dpwh_map_cells()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.dpwh_map_cells;
  insert into public.dpwh_map_cells (level, cell_lat, cell_lng, region, category, status_key, n, sum_lat, sum_lng)
  with base as materialized (
    select latitude as lat, longitude as lng, coalesce(region, '') as region, category::text as category,
           private.dpwh_status_key(status) as status_key
      from public.dpwh_contracts
     where latitude is not null and longitude is not null
  )
  select l.level, floor(b.lat / l.size)::integer, floor(b.lng / l.size)::integer,
         b.region, b.category, b.status_key, count(*)::integer, sum(b.lat), sum(b.lng)
    from base b
   cross join (values (0::smallint, 1.0::double precision), (1::smallint, 0.25::double precision), (2::smallint, 0.05::double precision)) as l(level, size)
   group by 1, 2, 3, 4, 5, 6;
end;
$$;
revoke execute on function private.refresh_dpwh_map_cells() from public;

-- After every successful sync the stats row is rewritten; rebuild the cells then.
create function private.dpwh_map_cells_after_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.refresh_dpwh_map_cells();
  exception when others or query_canceled then
    raise warning 'dpwh_map_cells rebuild failed: %', sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function private.dpwh_map_cells_after_stats() from public;

create trigger dpwh_map_cells_after_stats
  after insert or update on public.dpwh_directory_stats
  for each statement execute function private.dpwh_map_cells_after_stats();

-- One bubble per grid cell inside the viewport. Position is the average of its
-- contracts; the colour region is the one with the most contracts in the cell.
-- p_level: 0, 1 or 2 (coarse to fine). Filters are optional (null = all).
create function public.dpwh_map_bubbles(
  p_level    smallint,
  p_west     double precision,
  p_south    double precision,
  p_east     double precision,
  p_north    double precision,
  p_region   text default null,
  p_category text default null,
  p_status   text default null
)
returns table (lat double precision, lng double precision, n bigint, region text, statuses jsonb)
language sql
stable
set search_path = ''
as $$
  with size as (
    select case p_level when 0 then 1.0 when 1 then 0.25 else 0.05 end::double precision as s
  ),
  f as (
    select c.cell_lat, c.cell_lng, c.region, c.status_key, c.n, c.sum_lat, c.sum_lng
      from public.dpwh_map_cells c, size
     where c.level = least(greatest(p_level, 0), 2)
       and c.cell_lat between floor(p_south / size.s)::integer and floor(p_north / size.s)::integer
       and c.cell_lng between floor(p_west / size.s)::integer and floor(p_east / size.s)::integer
       and (p_region is null or c.region = p_region)
       and (p_category is null or c.category = p_category)
       and (p_status is null or c.status_key = p_status)
  ),
  tot as (
    select cell_lat, cell_lng, sum(n) as n, sum(sum_lat) / sum(n) as lat, sum(sum_lng) / sum(n) as lng
      from f group by cell_lat, cell_lng
  ),
  reg as (
    select distinct on (cell_lat, cell_lng) cell_lat, cell_lng, region
      from (select cell_lat, cell_lng, region, sum(n) as n from f group by cell_lat, cell_lng, region) r
     order by cell_lat, cell_lng, n desc, region
  ),
  st as (
    select cell_lat, cell_lng, jsonb_object_agg(status_key, n) as statuses
      from (select cell_lat, cell_lng, status_key, sum(n) as n from f group by cell_lat, cell_lng, status_key) s
     group by cell_lat, cell_lng
  )
  select tot.lat, tot.lng, tot.n, nullif(reg.region, ''), st.statuses
    from tot
    join reg using (cell_lat, cell_lng)
    join st using (cell_lat, cell_lng)
   order by tot.n desc
   limit 2500
$$;
revoke execute on function public.dpwh_map_bubbles(smallint, double precision, double precision, double precision, double precision, text, text, text) from public;
grant execute on function public.dpwh_map_bubbles(smallint, double precision, double precision, double precision, double precision, text, text, text) to anon, authenticated, service_role;

select private.refresh_dpwh_map_cells();
