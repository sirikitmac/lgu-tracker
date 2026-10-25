-- =============================================================================
-- LGU Tracker · Migration 8 · More BetterGov.ph sources, scoped DPWH sync
-- =============================================================================
-- Purely additive: nothing is dropped, deleted, or rewritten. Existing
-- functions are replaced with the same signatures and the same rules plus:
--
--   * DPWH sync scope. A run may be limited to a set of project regions
--     (dpwh_sync_runs.scope_regions; null = nationwide) so the import fits the
--     database plan. Rows outside the scope are counted in out_of_scope_count,
--     never stored, and never deleted if they were stored earlier.
--   * public.sync_storage_usage(): database size for the sync's storage guard
--     (admins / service role only).
--   * public.infrastructure_projects: project records from other BetterGov.ph
--     datasets (first: DPWH's FY 2027 NEP project list), keyed on
--     (source, source_id), with the original row kept in source_record.
--     Written only through the source_sync_* functions; every attempt is
--     logged in public.source_sync_runs.
--   * public.project_directory: one read-only view over DPWH contracts and
--     infrastructure_projects, with a `source` column, for the public
--     directory.
--   * dpwh_status gains 'proposed' (budget proposals, not yet contracts).
-- =============================================================================

alter type public.dpwh_status add value if not exists 'proposed';

-- -----------------------------------------------------------------------------
-- DPWH sync scope
-- -----------------------------------------------------------------------------
alter table public.dpwh_sync_runs
  add column scope_regions text[] check (scope_regions is null or cardinality(scope_regions) between 1 and 30),
  add column out_of_scope_count integer not null default 0 check (out_of_scope_count >= 0);

comment on column public.dpwh_sync_runs.scope_regions is
  'Project regions this run imported (null = nationwide). Rows outside it are counted, not stored.';

-- p_source: { source_dataset, source_file, source_revision, source_snapshot_at, source_rows, scope_regions? }
-- Same rules as migration 6; a running run is only resumed for the same
-- revision and the same scope.
create or replace function public.dpwh_sync_begin(p_trigger text, p_source jsonb, p_resume_run_id uuid default null)
returns public.dpwh_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_running public.dpwh_sync_runs;
  v_run public.dpwh_sync_runs;
  v_scope text[];
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can run DPWH syncs.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_source) is distinct from 'object' then
    raise exception 'p_source must be an object.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_source -> 'scope_regions') = 'array' then
    select array_agg(e order by e) into v_scope from jsonb_array_elements_text(p_source -> 'scope_regions') e;
  elsif coalesce(jsonb_typeof(p_source -> 'scope_regions'), 'null') <> 'null' then
    raise exception 'scope_regions must be an array or null.' using errcode = '22023';
  end if;

  select * into v_running from public.dpwh_sync_runs where status = 'running' for update;
  if found then
    if v_running.source_revision = p_source ->> 'source_revision'
       and v_running.scope_regions is not distinct from v_scope
       and (v_running.id = p_resume_run_id or v_running.heartbeat_at < now() - interval '15 minutes') then
      update public.dpwh_sync_runs set heartbeat_at = now() where id = v_running.id returning * into v_run;
      return v_run;
    end if;
    if v_running.heartbeat_at >= now() - interval '15 minutes' then
      raise exception 'A DPWH sync is already running (run %).', v_running.id using errcode = '55P03';
    end if;
    update public.dpwh_sync_runs
       set status = 'failed', finished_at = now(),
           error = 'Abandoned: no heartbeat for 15 minutes; superseded by a newer snapshot or scope.'
     where id = v_running.id;
  end if;

  insert into public.dpwh_sync_runs (
    trigger, triggered_by, source_dataset, source_file, source_revision, source_snapshot_at, source_rows, scope_regions
  ) values (
    p_trigger,
    (select auth.uid()),
    p_source ->> 'source_dataset',
    p_source ->> 'source_file',
    p_source ->> 'source_revision',
    (p_source ->> 'source_snapshot_at')::timestamptz,
    (p_source ->> 'source_rows')::integer,
    v_scope
  )
  returning * into v_run;
  return v_run;
end;
$$;

-- Same as migration 6, plus: rows in [p_row_start, p_row_end) that are
-- neither submitted nor rejected were outside the run's scope and are
-- counted in out_of_scope_count.
create or replace function public.dpwh_sync_apply_batch(
  p_run_id uuid,
  p_row_start integer,
  p_row_end integer,
  p_contracts jsonb,
  p_rejected jsonb default '[]'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.dpwh_sync_runs;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_submitted integer;
  v_out_of_scope integer;
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can run DPWH syncs.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_contracts) is distinct from 'array' or jsonb_typeof(p_rejected) is distinct from 'array' then
    raise exception 'p_contracts and p_rejected must be arrays.' using errcode = '22023';
  end if;
  v_submitted := jsonb_array_length(p_contracts);
  if v_submitted > 2000 then
    raise exception 'At most 2000 contracts per batch.' using errcode = '22023';
  end if;

  select * into v_run from public.dpwh_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' then
    raise exception 'Sync run % is not running.', p_run_id using errcode = '55000';
  end if;
  if p_row_end <= v_run.next_row then
    return jsonb_build_object('already_applied', true, 'next_row', v_run.next_row);
  end if;
  if p_row_start <> v_run.next_row or p_row_end <= p_row_start or p_row_end > v_run.source_rows then
    raise exception 'Batch [%, %) does not continue run % at row %.', p_row_start, p_row_end, p_run_id, v_run.next_row
      using errcode = '22023';
  end if;
  v_out_of_scope := (p_row_end - p_row_start) - v_submitted - jsonb_array_length(p_rejected);
  if v_out_of_scope < 0 then
    raise exception 'Batch [%, %) has more contracts and rejections than rows.', p_row_start, p_row_end using errcode = '22023';
  end if;
  -- A nationwide run skips nothing; keep migration 6's behaviour for it.
  if v_run.scope_regions is null then
    v_out_of_scope := 0;
  end if;
  if (select count(distinct e ->> 'contract_id') from jsonb_array_elements(p_contracts) e) <> v_submitted
     or exists (select 1 from jsonb_array_elements(p_contracts) e where e ->> 'contract_id' is null) then
    raise exception 'Every contract in a batch needs a unique contract_id.' using errcode = '22023';
  end if;
  if v_run.scope_regions is not null and exists (
    select 1 from jsonb_array_elements(p_contracts) e
     where not coalesce((e ->> 'region') = any (v_run.scope_regions), false)
  ) then
    raise exception 'Batch [%, %) contains contracts outside the run''s scope.', p_row_start, p_row_end using errcode = '22023';
  end if;

  with incoming as (
    select * from jsonb_populate_recordset(null::public.dpwh_contracts, p_contracts)
  ),
  upserted as (
    insert into public.dpwh_contracts as c (
      contract_id, title, contract_name, source_category, infra_type, category, category_method, category_reason,
      source_status, status, procurement_status_code, implementing_office, implementing_region,
      region, province, provinces, municipality, barangay, latitude, longitude,
      contractor, winner_names, budget, approved_budget, contract_amount, amount_paid,
      progress, start_date, completion_date, contract_effectivity_date, expiry_date, infra_year,
      program_name, source_of_funds, funding_instrument, advertisement_date, bid_submission_deadline, award_date,
      link_advertisement, link_contract_agreement, link_notice_of_award, link_notice_to_proceed,
      is_live, livestream_url, total_images, latest_image_date, source_verified_by_dpwh, source_verified_by_public,
      components, data_warnings, source_hash, source_revision, source_snapshot_at,
      first_seen_run_id, last_changed_run_id
    )
    select
      i.contract_id, i.title, i.contract_name, i.source_category, i.infra_type, i.category, i.category_method, i.category_reason,
      i.source_status, i.status, i.procurement_status_code, i.implementing_office, i.implementing_region,
      i.region, i.province, coalesce(i.provinces, '{}'), i.municipality, i.barangay, i.latitude, i.longitude,
      i.contractor, i.winner_names, i.budget, i.approved_budget, i.contract_amount, i.amount_paid,
      i.progress, i.start_date, i.completion_date, i.contract_effectivity_date, i.expiry_date, i.infra_year,
      i.program_name, i.source_of_funds, i.funding_instrument, i.advertisement_date, i.bid_submission_deadline, i.award_date,
      i.link_advertisement, i.link_contract_agreement, i.link_notice_of_award, i.link_notice_to_proceed,
      i.is_live, i.livestream_url, i.total_images, i.latest_image_date, i.source_verified_by_dpwh, i.source_verified_by_public,
      coalesce(i.components, '[]'), coalesce(i.data_warnings, '{}'), i.source_hash, v_run.source_revision, v_run.source_snapshot_at,
      p_run_id, p_run_id
    from incoming i
    on conflict (contract_id) do update set
      title = excluded.title, contract_name = excluded.contract_name,
      source_category = excluded.source_category, infra_type = excluded.infra_type,
      category = excluded.category, category_method = excluded.category_method, category_reason = excluded.category_reason,
      source_status = excluded.source_status, status = excluded.status, procurement_status_code = excluded.procurement_status_code,
      implementing_office = excluded.implementing_office, implementing_region = excluded.implementing_region,
      region = excluded.region, province = excluded.province, provinces = excluded.provinces,
      municipality = excluded.municipality, barangay = excluded.barangay,
      latitude = excluded.latitude, longitude = excluded.longitude,
      contractor = excluded.contractor, winner_names = excluded.winner_names,
      budget = excluded.budget, approved_budget = excluded.approved_budget,
      contract_amount = excluded.contract_amount, amount_paid = excluded.amount_paid,
      progress = excluded.progress, start_date = excluded.start_date, completion_date = excluded.completion_date,
      contract_effectivity_date = excluded.contract_effectivity_date, expiry_date = excluded.expiry_date,
      infra_year = excluded.infra_year, program_name = excluded.program_name, source_of_funds = excluded.source_of_funds,
      funding_instrument = excluded.funding_instrument, advertisement_date = excluded.advertisement_date,
      bid_submission_deadline = excluded.bid_submission_deadline, award_date = excluded.award_date,
      link_advertisement = excluded.link_advertisement, link_contract_agreement = excluded.link_contract_agreement,
      link_notice_of_award = excluded.link_notice_of_award, link_notice_to_proceed = excluded.link_notice_to_proceed,
      is_live = excluded.is_live, livestream_url = excluded.livestream_url, total_images = excluded.total_images,
      latest_image_date = excluded.latest_image_date, source_verified_by_dpwh = excluded.source_verified_by_dpwh,
      source_verified_by_public = excluded.source_verified_by_public, components = excluded.components,
      data_warnings = excluded.data_warnings, source_hash = excluded.source_hash,
      source_revision = excluded.source_revision, source_snapshot_at = excluded.source_snapshot_at,
      last_changed_run_id = excluded.last_changed_run_id
      -- first_seen_run_id is kept; unchanged rows are not rewritten.
    where c.source_hash is distinct from excluded.source_hash
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into v_inserted, v_updated
    from upserted;

  update public.dpwh_sync_runs
     set next_row = p_row_end,
         inserted_count = inserted_count + v_inserted,
         updated_count = updated_count + v_updated,
         unchanged_count = unchanged_count + (v_submitted - v_inserted - v_updated),
         rejected_count = rejected_count + jsonb_array_length(p_rejected),
         out_of_scope_count = out_of_scope_count + v_out_of_scope,
         rejected_sample = case
           when jsonb_array_length(rejected_sample) >= 200 then rejected_sample
           else rejected_sample || (select coalesce(jsonb_agg(e), '[]')
                                      from (select e from jsonb_array_elements(p_rejected) e
                                            limit greatest(0, 200 - jsonb_array_length(rejected_sample))) s)
         end,
         heartbeat_at = now()
   where id = p_run_id;

  return jsonb_build_object(
    'already_applied', false,
    'submitted', v_submitted,
    'inserted', v_inserted,
    'updated', v_updated,
    'unchanged', v_submitted - v_inserted - v_updated,
    'rejected', jsonb_array_length(p_rejected),
    'out_of_scope', v_out_of_scope,
    'next_row', p_row_end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage guard
-- -----------------------------------------------------------------------------
create or replace function public.sync_storage_usage()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can read storage usage.' using errcode = '42501';
  end if;
  return pg_database_size(current_database());
end;
$$;

revoke execute on function public.sync_storage_usage() from public, anon;
grant execute on function public.sync_storage_usage() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- source_sync_runs: one row per import attempt of a non-contract source
-- -----------------------------------------------------------------------------
create table public.source_sync_runs (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null check (source ~ '^[a-z][a-z0-9_]{2,49}$'),
  trigger             text not null check (trigger in ('cron', 'manual', 'cli')),
  triggered_by        uuid references public.profiles (id) on delete set null,
  status              public.dpwh_sync_status not null default 'running',
  source_dataset      text check (char_length(source_dataset) between 3 and 200),
  source_file         text check (char_length(source_file) between 3 and 200),
  source_revision     text check (source_revision ~ '^[0-9a-f]{40}$'),
  source_snapshot_at  timestamptz,
  source_rows         integer check (source_rows >= 0),
  processed_rows      integer not null default 0 check (processed_rows >= 0),
  inserted_count      integer not null default 0 check (inserted_count >= 0),
  updated_count       integer not null default 0 check (updated_count >= 0),
  unchanged_count     integer not null default 0 check (unchanged_count >= 0),
  rejected_count      integer not null default 0 check (rejected_count >= 0),
  rejected_sample     jsonb not null default '[]' check (jsonb_typeof(rejected_sample) = 'array'),
  error               text check (char_length(error) <= 4000),
  started_at          timestamptz not null default now(),
  heartbeat_at        timestamptz not null default now(),
  finished_at         timestamptz,

  constraint source_sync_runs_snapshot_check check (
    status = 'failed'
    or (source_dataset is not null and source_file is not null and source_revision is not null
        and source_snapshot_at is not null and source_rows is not null)
  )
);

-- At most one running import per source.
create unique index source_sync_runs_one_running_idx on public.source_sync_runs (source) where status = 'running';
create index source_sync_runs_started_idx on public.source_sync_runs (source, started_at desc);

-- -----------------------------------------------------------------------------
-- infrastructure_projects: records from non-contract BetterGov.ph datasets
-- -----------------------------------------------------------------------------
create table public.infrastructure_projects (
  id                   uuid primary key default gen_random_uuid(),
  source               text not null check (source ~ '^[a-z][a-z0-9_]{2,49}$'),
  source_id            text not null check (source_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$'),

  title                text not null check (char_length(title) between 1 and 4000),
  category             public.dpwh_category not null,
  category_method      text not null check (category_method in
                         ('source_category', 'infra_type', 'type_of_work', 'description_keywords', 'none')),
  category_reason      text not null,
  status               public.dpwh_status not null,

  -- Location as reported; null when the source does not provide it.
  region               text,
  province             text,
  municipality         text,
  latitude             double precision,
  longitude            double precision,

  implementing_office  text,
  program_name         text,
  sub_program          text,
  project_type         text,
  amount               numeric check (amount >= 0),
  amount_label         text not null check (char_length(amount_label) between 1 and 100),
  fiscal_year          smallint check (fiscal_year between 1990 and 2100),

  -- The original source row, unmodified, for provenance.
  source_record        jsonb not null check (jsonb_typeof(source_record) = 'object'),
  data_warnings        text[] not null default '{}',

  source_hash          text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_dataset       text not null,
  source_file          text not null,
  source_revision      text not null check (source_revision ~ '^[0-9a-f]{40}$'),
  source_snapshot_at   timestamptz not null,
  first_seen_run_id    uuid not null references public.source_sync_runs (id) on delete restrict,
  last_changed_run_id  uuid not null references public.source_sync_runs (id) on delete restrict,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint infrastructure_projects_source_id_key unique (source, source_id),
  constraint infrastructure_projects_valid_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

comment on table public.infrastructure_projects is
  'Infrastructure project records from BetterGov.ph datasets other than the DPWH contract snapshot. Source-reported values; not verified by the LGU.';

-- Same expression as project_directory.search for this arm, so the planner uses it.
create index infrastructure_projects_search_idx on public.infrastructure_projects using gin (
  to_tsvector('simple'::regconfig,
    source_id || ' ' || title || ' ' || coalesce(implementing_office, '') || ' ' || coalesce(program_name, ''))
);
create index infrastructure_projects_region_idx on public.infrastructure_projects (region);
create index infrastructure_projects_amount_idx on public.infrastructure_projects (amount);
create index infrastructure_projects_coordinates_idx on public.infrastructure_projects (latitude, longitude)
  where latitude is not null;

create trigger infrastructure_projects_set_updated_at before update on public.infrastructure_projects
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- project_directory: every source in one list (read-only, caller's RLS)
-- -----------------------------------------------------------------------------
create view public.project_directory
with (security_invoker = true)
as
select
  'dpwh_contracts'::text as source,
  contract_id as record_id,
  title, contract_name, category, status, region, province, provinces, municipality,
  implementing_office, contractor, budget, contract_amount, progress, start_date, completion_date, infra_year,
  to_tsvector('simple'::regconfig,
    contract_id || ' ' || coalesce(title, '') || ' ' || coalesce(contract_name, '') || ' ' ||
    coalesce(contractor, '') || ' ' || coalesce(implementing_office, '')) as search,
  latitude, longitude, contract_effectivity_date,
  'Contract amount'::text as amount_label
from public.dpwh_contracts
union all
select
  source,
  source_id,
  title, null::text, category, status, region, province,
  case when province is null then '{}'::text[] else array[province] end, municipality,
  implementing_office, null::text, amount, null::numeric, null::numeric, null::date, null::date, fiscal_year,
  to_tsvector('simple'::regconfig,
    source_id || ' ' || title || ' ' || coalesce(implementing_office, '') || ' ' || coalesce(program_name, '')),
  latitude, longitude, null::date,
  amount_label
from public.infrastructure_projects;

comment on view public.project_directory is
  'All imported project records: DPWH contracts (source dpwh_contracts) and infrastructure_projects, one row per source record.';

-- -----------------------------------------------------------------------------
-- RLS, grants, policies (see SECURITY_NOTES.md §3)
-- -----------------------------------------------------------------------------
alter table public.source_sync_runs        enable row level security;
alter table public.infrastructure_projects enable row level security;

revoke all on public.source_sync_runs, public.infrastructure_projects, public.project_directory from anon, authenticated;

-- Public government records (CC0 / public documents), like dpwh_contracts.
grant select on public.infrastructure_projects, public.project_directory to anon, authenticated;
grant select on public.source_sync_runs to authenticated;
grant select, insert, update, delete on public.source_sync_runs, public.infrastructure_projects to service_role;

create policy "infrastructure projects: public read"
  on public.infrastructure_projects for select
  to anon, authenticated
  using (true);

create policy "source sync runs: admins read"
  on public.source_sync_runs for select
  to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- RPC: start a source import
-- -----------------------------------------------------------------------------
-- p_meta: { source_dataset, source_file, source_revision, source_snapshot_at, source_rows }
-- A running import of the same source that has gone quiet for 15 minutes is
-- marked failed and replaced; an active one refuses with 55P03.
create or replace function public.source_sync_begin(p_source text, p_trigger text, p_meta jsonb)
returns public.source_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_running public.source_sync_runs;
  v_run public.source_sync_runs;
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can import sources.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_meta) is distinct from 'object' then
    raise exception 'p_meta must be an object.' using errcode = '22023';
  end if;

  select * into v_running from public.source_sync_runs where source = p_source and status = 'running' for update;
  if found then
    if v_running.heartbeat_at >= now() - interval '15 minutes' then
      raise exception 'An import of % is already running (run %).', p_source, v_running.id using errcode = '55P03';
    end if;
    update public.source_sync_runs
       set status = 'failed', finished_at = now(), error = 'Abandoned: no heartbeat for 15 minutes.'
     where id = v_running.id;
  end if;

  insert into public.source_sync_runs (
    source, trigger, triggered_by, source_dataset, source_file, source_revision, source_snapshot_at, source_rows
  ) values (
    p_source, p_trigger, (select auth.uid()),
    p_meta ->> 'source_dataset', p_meta ->> 'source_file', p_meta ->> 'source_revision',
    (p_meta ->> 'source_snapshot_at')::timestamptz, (p_meta ->> 'source_rows')::integer
  )
  returning * into v_run;
  return v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: upsert one batch of normalized records for a running import
-- -----------------------------------------------------------------------------
-- p_rows_seen: source rows this batch covers (records + rejections).
-- Upserts on (source, source_id); rows whose source_hash is unchanged are not
-- rewritten. Nothing is deleted.
create or replace function public.source_sync_apply_batch(p_run_id uuid, p_rows_seen integer, p_records jsonb, p_rejected jsonb default '[]')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.source_sync_runs;
  v_submitted integer;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can import sources.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_typeof(p_rejected) is distinct from 'array' then
    raise exception 'p_records and p_rejected must be arrays.' using errcode = '22023';
  end if;
  v_submitted := jsonb_array_length(p_records);
  if v_submitted > 2000 then
    raise exception 'At most 2000 records per batch.' using errcode = '22023';
  end if;
  if p_rows_seen <> v_submitted + jsonb_array_length(p_rejected) then
    raise exception 'p_rows_seen must equal records plus rejections.' using errcode = '22023';
  end if;

  select * into v_run from public.source_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' then
    raise exception 'Import run % is not running.', p_run_id using errcode = '55000';
  end if;
  if v_run.processed_rows + p_rows_seen > v_run.source_rows then
    raise exception 'Batch exceeds the % rows of run %.', v_run.source_rows, p_run_id using errcode = '22023';
  end if;
  if (select count(distinct e ->> 'source_id') from jsonb_array_elements(p_records) e) <> v_submitted
     or exists (select 1 from jsonb_array_elements(p_records) e where e ->> 'source_id' is null) then
    raise exception 'Every record in a batch needs a unique source_id.' using errcode = '22023';
  end if;

  with incoming as (
    select * from jsonb_populate_recordset(null::public.infrastructure_projects, p_records)
  ),
  upserted as (
    insert into public.infrastructure_projects as p (
      source, source_id, title, category, category_method, category_reason, status,
      region, province, municipality, latitude, longitude,
      implementing_office, program_name, sub_program, project_type, amount, amount_label, fiscal_year,
      source_record, data_warnings, source_hash, source_dataset, source_file, source_revision, source_snapshot_at,
      first_seen_run_id, last_changed_run_id
    )
    select
      v_run.source, i.source_id, i.title, i.category, i.category_method, i.category_reason, i.status,
      i.region, i.province, i.municipality, i.latitude, i.longitude,
      i.implementing_office, i.program_name, i.sub_program, i.project_type, i.amount, i.amount_label, i.fiscal_year,
      i.source_record, coalesce(i.data_warnings, '{}'), i.source_hash,
      v_run.source_dataset, v_run.source_file, v_run.source_revision, v_run.source_snapshot_at,
      p_run_id, p_run_id
    from incoming i
    on conflict (source, source_id) do update set
      title = excluded.title, category = excluded.category, category_method = excluded.category_method,
      category_reason = excluded.category_reason, status = excluded.status,
      region = excluded.region, province = excluded.province, municipality = excluded.municipality,
      latitude = excluded.latitude, longitude = excluded.longitude,
      implementing_office = excluded.implementing_office, program_name = excluded.program_name,
      sub_program = excluded.sub_program, project_type = excluded.project_type,
      amount = excluded.amount, amount_label = excluded.amount_label, fiscal_year = excluded.fiscal_year,
      source_record = excluded.source_record, data_warnings = excluded.data_warnings, source_hash = excluded.source_hash,
      source_dataset = excluded.source_dataset, source_file = excluded.source_file,
      source_revision = excluded.source_revision, source_snapshot_at = excluded.source_snapshot_at,
      last_changed_run_id = excluded.last_changed_run_id
    where p.source_hash is distinct from excluded.source_hash
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted)
    into v_inserted, v_updated
    from upserted;

  update public.source_sync_runs
     set processed_rows = processed_rows + p_rows_seen,
         inserted_count = inserted_count + v_inserted,
         updated_count = updated_count + v_updated,
         unchanged_count = unchanged_count + (v_submitted - v_inserted - v_updated),
         rejected_count = rejected_count + jsonb_array_length(p_rejected),
         rejected_sample = case
           when jsonb_array_length(rejected_sample) >= 200 then rejected_sample
           else rejected_sample || (select coalesce(jsonb_agg(e), '[]')
                                      from (select e from jsonb_array_elements(p_rejected) e
                                            limit greatest(0, 200 - jsonb_array_length(rejected_sample))) s)
         end,
         heartbeat_at = now()
   where id = p_run_id;

  return jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'unchanged', v_submitted - v_inserted - v_updated,
    'rejected', jsonb_array_length(p_rejected)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: finish an import ('succeeded' only when every source row was seen)
-- -----------------------------------------------------------------------------
create or replace function public.source_sync_finish(p_run_id uuid, p_status public.dpwh_sync_status, p_error text default null)
returns public.source_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.source_sync_runs;
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can import sources.' using errcode = '42501';
  end if;
  if p_status = 'running' then
    raise exception 'Cannot finish a run as running.' using errcode = '22023';
  end if;
  select * into v_run from public.source_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' then
    raise exception 'Import run % is not running.', p_run_id using errcode = '55000';
  end if;
  if p_status = 'succeeded' and v_run.processed_rows <> v_run.source_rows then
    raise exception 'Run % processed % of % rows; cannot mark succeeded.', p_run_id, v_run.processed_rows, v_run.source_rows
      using errcode = '22023';
  end if;
  update public.source_sync_runs
     set status = p_status, finished_at = now(), heartbeat_at = now(), error = left(p_error, 4000)
   where id = p_run_id
  returning * into v_run;
  return v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: record an import that failed before it could start
-- -----------------------------------------------------------------------------
create or replace function public.source_sync_log_failure(p_source text, p_trigger text, p_error text, p_meta jsonb default null)
returns public.source_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.source_sync_runs;
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can import sources.' using errcode = '42501';
  end if;
  insert into public.source_sync_runs (
    source, trigger, triggered_by, status, source_dataset, source_file, source_revision, source_snapshot_at,
    source_rows, error, finished_at
  ) values (
    p_source, p_trigger, (select auth.uid()), 'failed',
    p_meta ->> 'source_dataset', p_meta ->> 'source_file', p_meta ->> 'source_revision',
    (p_meta ->> 'source_snapshot_at')::timestamptz, (p_meta ->> 'source_rows')::integer,
    left(coalesce(p_error, 'Unknown error'), 4000), now()
  )
  returning * into v_run;
  return v_run;
end;
$$;

revoke execute on function public.source_sync_begin(text, text, jsonb) from public, anon;
revoke execute on function public.source_sync_apply_batch(uuid, integer, jsonb, jsonb) from public, anon;
revoke execute on function public.source_sync_finish(uuid, public.dpwh_sync_status, text) from public, anon;
revoke execute on function public.source_sync_log_failure(text, text, text, jsonb) from public, anon;
grant execute on function public.source_sync_begin(text, text, jsonb) to authenticated, service_role;
grant execute on function public.source_sync_apply_batch(uuid, integer, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.source_sync_finish(uuid, public.dpwh_sync_status, text) to authenticated, service_role;
grant execute on function public.source_sync_log_failure(text, text, text, jsonb) to authenticated, service_role;
