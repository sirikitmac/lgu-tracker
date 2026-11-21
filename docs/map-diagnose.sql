-- Run in the Supabase SQL editor (as postgres). Read-only. Paste the output back.
-- 1. How slow is the map's two queries for the whole country (the first load)?
explain (analyze, buffers, timing off)
select contract_id from public.dpwh_contracts_directory
where latitude is not null and longitude is not null
  and latitude between 4 and 22 and longitude between 116 and 128
order by contract_amount desc nulls last, contract_id
limit 1000;

explain (analyze, buffers, timing off)
select count(*) from public.dpwh_contracts_directory
where latitude is not null and longitude is not null
  and latitude between 4 and 22 and longitude between 116 and 128;

-- 2. A zoomed-in view (Iligan area), the case where the ordered scan can walk many rows.
explain (analyze, buffers, timing off)
select contract_id from public.dpwh_contracts_directory
where latitude is not null and longitude is not null
  and latitude between 8.0 and 8.4 and longitude between 123.9 and 124.4
order by contract_amount desc nulls last, contract_id
limit 1000;

-- 3. The timeout the anon role runs with, and the size of the table.
select rolname, rolconfig from pg_roles where rolname in ('anon','authenticated','authenticator');
select pg_size_pretty(pg_total_relation_size('public.dpwh_contracts')) as table_total,
       (select reltuples::bigint from pg_class where oid = 'public.dpwh_contracts'::regclass) as approx_rows;
