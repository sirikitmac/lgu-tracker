-- =============================================================================
-- LGU Tracker · Guarded cleanup of unused tables
-- =============================================================================
-- NOT a migration (it lives outside supabase/migrations on purpose, so
-- `supabase db push` never runs it). Run it by hand in the SQL Editor.
--
-- What it does: for each table in `candidates` it only drops the table when ALL
-- of these hold, and otherwise leaves it and tells you why:
--   1. the table exists,
--   2. it has zero rows,
--   3. no other table has a foreign key to it,
--   4. no function in public/private, no policy on another table, and no view
--      mentions it by name (function bodies are not tracked by Postgres
--      dependencies, so this is checked by text; it errs on the side of keeping).
-- DROP is issued WITHOUT CASCADE.
--
-- It starts in dry-run mode: it only prints NOTICE lines. Set dry_run := false
-- to really drop. Back up first (Dashboard → Database → Backups).
--
-- Migrations that created these tables stay in supabase/migrations. A fresh
-- database built from them would recreate the tables, so after dropping, add a
-- migration that drops them too, or the two will drift apart.
-- =============================================================================

do $$
declare
  dry_run    boolean := true;   -- <<< set to false to actually drop

  -- Tables the app code never reads or writes (checked against src/ and
  -- scripts/) and that no other table depends on. Edit as you see fit.
  candidates text[] := array[
    'organization_contacts',   -- staff-only contact emails; no UI uses it
    'comments',                -- discussion threads; no UI uses it
    'attachments'              -- file metadata; no upload feature or storage bucket yet
  ];

  -- DELIBERATELY NOT LISTED (still in use, directly or through RLS):
  --   projects, project_assignments, project_milestones, project_status_history,
  --   proposals, proposal_decisions, organizations   → the local-project
  --     workflow behind /dashboard and the reports RLS helpers.
  --   reports, profiles, audit_log                   → accounts and reporting.
  --   dpwh_*, subaybayan_*, infrastructure_projects, source_sync_runs,
  --   landing_stats                                  → the public directory.
  -- If you decide to retire the whole local-project workflow, that is a
  -- bigger change (RLS helpers, enums, the /dashboard pages): ask for it
  -- separately instead of adding those tables here.

  t          text;
  n          bigint;
  blockers   text;
begin
  foreach t in array candidates loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'SKIP   %: table does not exist', t;
      continue;
    end if;

    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then
      raise notice 'KEEP   %: has % row(s)', t, n;
      continue;
    end if;

    select string_agg(x, '; ') into blockers from (
      select 'foreign key from ' || k.conrelid::regclass::text as x
        from pg_constraint k
       where k.contype = 'f' and k.confrelid = to_regclass('public.' || quote_ident(t))
         and k.conrelid <> k.confrelid
      union all
      select 'function ' || pn.nspname || '.' || p.proname
        from pg_proc p join pg_namespace pn on pn.oid = p.pronamespace
       where pn.nspname in ('public', 'private')
         and p.prosrc ~* ('\m' || t || '\M')
      union all
      select 'policy "' || pol.policyname || '" on ' || pol.tablename
        from pg_policies pol
       where pol.schemaname = 'public' and pol.tablename <> t
         and (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~* ('\m' || t || '\M')
      union all
      select 'view ' || v.viewname
        from pg_views v
       where v.schemaname = 'public' and v.definition ~* ('\m' || t || '\M')
    ) s;

    if blockers is not null then
      raise notice 'KEEP   %: empty, but still referenced by: %', t, blockers;
      continue;
    end if;

    if dry_run then
      raise notice 'WOULD DROP %: empty and unreferenced', t;
    else
      execute format('drop table public.%I', t);
      raise notice 'DROPPED %', t;
    end if;
  end loop;
end
$$;
