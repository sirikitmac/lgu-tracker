-- =============================================================================
-- LGU Tracker · READ-ONLY table audit
-- =============================================================================
-- Paste into the Supabase SQL Editor (or `supabase db query`). Changes nothing.
--
-- For every table in `public`: exact row count, size, how many other tables
-- point at it with a foreign key, and how many functions / policies / views
-- mention it by name. A table that is empty AND has nothing pointing at it AND
-- is not mentioned anywhere is safe to drop; maintenance/drop_unused_tables.sql
-- applies exactly those checks.
-- =============================================================================

select
  c.relname                                         as table_name,
  (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')
        ))[1]::text::bigint                         as row_count,
  pg_size_pretty(pg_total_relation_size(c.oid))     as total_size,
  (select count(*) from pg_constraint k
    where k.contype = 'f' and k.confrelid = c.oid
      and k.conrelid <> c.oid)                      as fks_from_other_tables,
  (select count(*) from pg_proc p
     join pg_namespace pn on pn.oid = p.pronamespace
    where pn.nspname in ('public', 'private')
      and p.prosrc ~* ('\m' || c.relname || '\M'))  as functions_mentioning,
  (select count(*) from pg_policies pol
    where pol.schemaname = 'public' and pol.tablename <> c.relname
      and (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~* ('\m' || c.relname || '\M'))
                                                    as other_tables_policies_mentioning,
  (select count(*) from pg_views v
    where v.schemaname = 'public'
      and v.definition ~* ('\m' || c.relname || '\M')) as views_mentioning
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by row_count, table_name;
