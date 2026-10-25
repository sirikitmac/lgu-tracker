-- =============================================================================
-- LGU Tracker · Migration 6 · Nationwide DPWH contract directory
-- =============================================================================
-- Stores every DPWH infrastructure contract from BetterGov.ph's CC0 snapshot
-- of the DPWH Transparency Portal (Hugging Face dataset
-- bettergovph/dpwh-transparency-data), plus sync-run bookkeeping, a cached
-- directory summary, and a separate table for LGU-entered review fields.
--
-- Purely additive: no existing table, type, role, policy, or function is
-- changed, and public.projects is never written.
--
-- Source vs LGU data
--   dpwh_contracts         source-derived only; rewritten by the sync.
--   dpwh_contract_reviews  LGU-entered verification fields; the sync never
--                          writes it, so updates cannot overwrite them.
--
-- Location
--   region / province come from the contract's components (the location
--   DPWH reports for the work). implementing_office / implementing_region
--   are the DPWH office that runs the contract and are kept separate; they
--   are never used as the project location. The source has no municipality
--   or barangay field, so those columns stay null until a source provides them.
--
-- Write path
--   Only the dpwh_sync_* functions, callable by an active super_admin /
--   lgu_admin or the server-side service role. No end-user role has
--   INSERT/UPDATE/DELETE on the source tables. Upserts are keyed on
--   contract_id, so re-running a sync never duplicates contracts, and rows
--   whose source values are unchanged are not rewritten. Nothing here
--   deletes contracts.
-- =============================================================================

create type public.dpwh_category as enum (
  'roads_highways',
  'bridges',
  'flood_control_drainage',
  'buildings_facilities',
  'water_infrastructure',
  'other_infrastructure',
  'uncategorized'
);

create type public.dpwh_status as enum (
  'completed',
  'ongoing',
  'for_procurement',
  'not_yet_started',
  'terminated',
  'unknown'
);

create type public.dpwh_sync_status as enum ('running', 'succeeded', 'failed', 'no_new_snapshot');

-- -----------------------------------------------------------------------------
-- dpwh_sync_runs: one row per sync attempt; also the resume cursor
-- -----------------------------------------------------------------------------
create table public.dpwh_sync_runs (
  id                  uuid primary key default gen_random_uuid(),
  trigger             text not null check (trigger in ('cron', 'manual', 'cli')),
  triggered_by        uuid references public.profiles (id) on delete set null,
  status              public.dpwh_sync_status not null default 'running',
  -- Null only for runs that failed before a snapshot could be identified.
  source_dataset      text check (char_length(source_dataset) between 3 and 200),
  source_file         text check (char_length(source_file) between 3 and 200),
  source_revision     text check (source_revision ~ '^[0-9a-f]{40}$'),
  source_snapshot_at  timestamptz,
  source_rows         integer check (source_rows >= 0),
  next_row            integer not null default 0 check (next_row >= 0),
  inserted_count      integer not null default 0 check (inserted_count >= 0),
  updated_count       integer not null default 0 check (updated_count >= 0),
  unchanged_count     integer not null default 0 check (unchanged_count >= 0),
  rejected_count      integer not null default 0 check (rejected_count >= 0),
  rejected_sample     jsonb not null default '[]' check (jsonb_typeof(rejected_sample) = 'array'),
  error               text check (char_length(error) <= 4000),
  started_at          timestamptz not null default now(),
  heartbeat_at        timestamptz not null default now(),
  finished_at         timestamptz,

  constraint dpwh_sync_runs_cursor_check check (next_row <= source_rows),
  constraint dpwh_sync_runs_source_check check (
    status = 'failed'
    or (source_dataset is not null and source_file is not null and source_revision is not null
        and source_snapshot_at is not null and source_rows is not null)
  )
);

-- At most one sync can be running at a time.
create unique index dpwh_sync_runs_one_running_idx on public.dpwh_sync_runs ((true)) where status = 'running';
create index dpwh_sync_runs_started_idx on public.dpwh_sync_runs (started_at desc);

-- -----------------------------------------------------------------------------
-- dpwh_contracts: one row per DPWH contract ID (source-derived only)
-- -----------------------------------------------------------------------------
create table public.dpwh_contracts (
  contract_id                text primary key check (contract_id ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,49}$'),

  -- Names
  title                      text not null check (char_length(title) between 1 and 4000), -- DPWH "description"
  contract_name              text,  -- procurement contract name; null when identical to title

  -- Category (this app's deterministic classification; source values kept)
  source_category            text,
  infra_type                 text,
  category                   public.dpwh_category not null,
  category_method            text not null check (category_method in
                               ('source_category', 'infra_type', 'type_of_work', 'description_keywords', 'none')),
  category_reason            text not null,

  -- Status
  source_status              text,
  status                     public.dpwh_status not null,
  procurement_status_code    text,

  -- Implementing office (NOT the project location)
  implementing_office        text,
  implementing_region        text,

  -- Reported location (from components); null when not provided
  region                     text,
  province                   text,
  provinces                  text[] not null default '{}',
  municipality               text,
  barangay                   text,
  latitude                   double precision,
  longitude                  double precision,

  -- Parties
  contractor                 text,
  winner_names               text,

  -- Amounts: different concepts, never summed together
  budget                     numeric check (budget >= 0),          -- DPWH "budget"
  approved_budget            numeric check (approved_budget >= 0), -- ABC (approved budget for the contract)
  contract_amount            numeric check (contract_amount >= 0), -- award amount
  amount_paid                numeric check (amount_paid >= 0),     -- as reported; usually 0

  -- Progress and dates
  progress                   numeric check (progress between 0 and 100),
  start_date                 date,
  completion_date            date,
  contract_effectivity_date  date,
  expiry_date                date,
  infra_year                 smallint check (infra_year between 1990 and 2100),

  -- Funding and procurement
  program_name               text,
  source_of_funds            text,
  funding_instrument         text,
  advertisement_date         date,
  bid_submission_deadline    date,
  award_date                 date,
  link_advertisement         text check (link_advertisement ~ '^https?://'),
  link_contract_agreement    text check (link_contract_agreement ~ '^https?://'),
  link_notice_of_award       text check (link_notice_of_award ~ '^https?://'),
  link_notice_to_proceed     text check (link_notice_to_proceed ~ '^https?://'),

  -- Monitoring flags as reported by the source
  is_live                    boolean,
  livestream_url             text,
  total_images               integer check (total_images >= 0),
  latest_image_date          date,
  source_verified_by_dpwh    boolean,
  source_verified_by_public  boolean,

  components                 jsonb not null default '[]' check (jsonb_typeof(components) = 'array'),
  data_warnings              text[] not null default '{}',

  -- Provenance. The snapshot file URL is derived from source_revision and the
  -- BetterGov record URL from contract_id (by the API), so neither is stored.
  source_hash                text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_revision            text not null check (source_revision ~ '^[0-9a-f]{40}$'),
  source_snapshot_at         timestamptz not null,
  first_seen_run_id          uuid not null references public.dpwh_sync_runs (id) on delete restrict,
  last_changed_run_id        uuid not null references public.dpwh_sync_runs (id) on delete restrict,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint dpwh_contracts_valid_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

comment on table public.dpwh_contracts is
  'DPWH contracts from the BetterGov.ph CC0 snapshot of the DPWH Transparency Portal. Source-reported values; not verified by the LGU.';
comment on column public.dpwh_contracts.region is
  'Region reported for the contract components (project location). Not the implementing office region.';
comment on column public.dpwh_contracts.implementing_office is
  'DPWH office implementing the contract (often a District Engineering Office). Not the project location.';
comment on column public.dpwh_contracts.contract_amount is
  'Award amount as reported. Not a disbursement or audited expenditure.';
comment on column public.dpwh_contracts.amount_paid is
  'As reported by DPWH; usually 0 even for completed contracts. Do not use as disbursement data.';

-- Full-text search uses an expression index instead of a stored tsvector
-- (saves ~100 MB nationwide). The directory view below exposes the same
-- expression as `search`; the planner inlines the view and uses this index.
create index dpwh_contracts_search_idx on public.dpwh_contracts using gin (
  to_tsvector('simple'::regconfig,
    contract_id || ' ' || coalesce(title, '') || ' ' || coalesce(contract_name, '') || ' ' ||
    coalesce(contractor, '') || ' ' || coalesce(implementing_office, ''))
);
create index dpwh_contracts_provinces_idx on public.dpwh_contracts using gin (provinces);
create index dpwh_contracts_region_idx on public.dpwh_contracts (region);
create index dpwh_contracts_municipality_idx on public.dpwh_contracts (municipality) where municipality is not null;
create index dpwh_contracts_category_idx on public.dpwh_contracts (category);
create index dpwh_contracts_status_idx on public.dpwh_contracts (status);
create index dpwh_contracts_office_idx on public.dpwh_contracts (implementing_office);
create index dpwh_contracts_contract_amount_idx on public.dpwh_contracts (contract_amount);
create index dpwh_contracts_budget_idx on public.dpwh_contracts (budget);
create index dpwh_contracts_progress_idx on public.dpwh_contracts (progress);
create index dpwh_contracts_start_date_idx on public.dpwh_contracts (start_date);
create index dpwh_contracts_first_seen_idx on public.dpwh_contracts (first_seen_run_id);
create index dpwh_contracts_last_changed_idx on public.dpwh_contracts (last_changed_run_id);

create trigger dpwh_contracts_set_updated_at before update on public.dpwh_contracts
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- dpwh_contracts_directory: list columns + search vector for the directory
-- -----------------------------------------------------------------------------
-- security_invoker: the caller's privileges and RLS on dpwh_contracts apply.
create view public.dpwh_contracts_directory
with (security_invoker = true)
as
select
  contract_id, title, contract_name, category, status, region, province, provinces, municipality,
  implementing_office, contractor, budget, contract_amount, progress, start_date, completion_date, infra_year,
  to_tsvector('simple'::regconfig,
    contract_id || ' ' || coalesce(title, '') || ' ' || coalesce(contract_name, '') || ' ' ||
    coalesce(contractor, '') || ' ' || coalesce(implementing_office, '')) as search
from public.dpwh_contracts;

-- -----------------------------------------------------------------------------
-- dpwh_contract_reviews: LGU-entered fields, never touched by the sync
-- -----------------------------------------------------------------------------
create table public.dpwh_contract_reviews (
  contract_id         text primary key references public.dpwh_contracts (contract_id) on delete restrict,
  id                  uuid not null unique default gen_random_uuid(), -- for audit_log.record_id
  is_field_verified   boolean not null default false,
  verified_at         timestamptz,
  verified_by         uuid references public.profiles (id) on delete set null,
  verification_notes  text check (char_length(verification_notes) <= 5000),
  linked_project_id   uuid references public.projects (id) on delete set null,
  updated_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint dpwh_contract_reviews_verified_check check (
    not is_field_verified or (verified_at is not null and verified_by is not null)
  )
);

create trigger dpwh_contract_reviews_set_updated_at before update on public.dpwh_contract_reviews
  for each row execute function private.set_updated_at();
create trigger dpwh_contract_reviews_audit after insert or update or delete on public.dpwh_contract_reviews
  for each row execute function private.audit_row_change();

-- -----------------------------------------------------------------------------
-- dpwh_directory_stats: cached summary + filter options (single row)
-- -----------------------------------------------------------------------------
create table public.dpwh_directory_stats (
  id                        smallint primary key default 1 check (id = 1),
  computed_at               timestamptz not null,
  last_successful_sync_at   timestamptz,
  source_revision           text,
  source_snapshot_at        timestamptz,
  stats                     jsonb not null check (jsonb_typeof(stats) = 'object')
);

-- -----------------------------------------------------------------------------
-- Helpers (private schema: not callable through the Data API)
-- -----------------------------------------------------------------------------
-- Inside SECURITY DEFINER functions current_user is the owner, so the gate
-- relies on the verified JWT: an active admin profile, or the service role.
create or replace function private.can_run_dpwh_sync()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

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
                      from (select infra_year, count(*) n from public.dpwh_contracts group by infra_year) s)
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

-- -----------------------------------------------------------------------------
-- RLS, grants, policies
-- -----------------------------------------------------------------------------
-- Supabase's default privileges grant anon/authenticated full access to new
-- tables (see migration 4), so revoke first and grant only what is needed.
alter table public.dpwh_sync_runs        enable row level security;
alter table public.dpwh_contracts        enable row level security;
alter table public.dpwh_contract_reviews enable row level security;
alter table public.dpwh_directory_stats  enable row level security;

revoke all on public.dpwh_sync_runs, public.dpwh_contracts, public.dpwh_contract_reviews, public.dpwh_directory_stats,
  public.dpwh_contracts_directory
  from anon, authenticated;

-- Source data and the summary are public government records (CC0 compilation).
grant select on public.dpwh_contracts, public.dpwh_contracts_directory, public.dpwh_directory_stats to anon, authenticated;
grant select on public.dpwh_sync_runs to authenticated;
grant select, insert, update on public.dpwh_contract_reviews to authenticated;
grant select, insert, update, delete on
  public.dpwh_sync_runs, public.dpwh_contracts, public.dpwh_contract_reviews, public.dpwh_directory_stats
  to service_role;

create policy "dpwh contracts: public read"
  on public.dpwh_contracts for select
  to anon, authenticated
  using (true);

create policy "dpwh directory stats: public read"
  on public.dpwh_directory_stats for select
  to anon, authenticated
  using (true);

create policy "dpwh sync runs: admins read"
  on public.dpwh_sync_runs for select
  to authenticated
  using ((select private.is_admin()));

create policy "dpwh reviews: staff read"
  on public.dpwh_contract_reviews for select
  to authenticated
  using ((select private.is_staff()));

create policy "dpwh reviews: reviewers insert"
  on public.dpwh_contract_reviews for insert
  to authenticated
  with check ((select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer', 'project_engineer']::public.app_role[])));

create policy "dpwh reviews: reviewers update"
  on public.dpwh_contract_reviews for update
  to authenticated
  using ((select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer', 'project_engineer']::public.app_role[])))
  with check ((select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer', 'project_engineer']::public.app_role[])));

-- -----------------------------------------------------------------------------
-- RPC: start (or resume) a sync run
-- -----------------------------------------------------------------------------
-- p_source: { source_dataset, source_file, source_revision, source_snapshot_at, source_rows }
-- Resumes an existing running run for the same revision when p_resume_run_id
-- matches or when the running run has gone quiet (no heartbeat for 15 min).
-- A different revision's stale run is marked failed; nothing is deleted.
create or replace function public.dpwh_sync_begin(p_trigger text, p_source jsonb, p_resume_run_id uuid default null)
returns public.dpwh_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_running public.dpwh_sync_runs;
  v_run public.dpwh_sync_runs;
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can run DPWH syncs.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_source) is distinct from 'object' then
    raise exception 'p_source must be an object.' using errcode = '22023';
  end if;

  select * into v_running from public.dpwh_sync_runs where status = 'running' for update;
  if found then
    if v_running.source_revision = p_source ->> 'source_revision'
       and (v_running.id = p_resume_run_id or v_running.heartbeat_at < now() - interval '15 minutes') then
      update public.dpwh_sync_runs set heartbeat_at = now() where id = v_running.id returning * into v_run;
      return v_run;
    end if;
    if v_running.heartbeat_at >= now() - interval '15 minutes' then
      raise exception 'A DPWH sync is already running (run %).', v_running.id using errcode = '55P03';
    end if;
    update public.dpwh_sync_runs
       set status = 'failed', finished_at = now(),
           error = 'Abandoned: no heartbeat for 15 minutes; superseded by a newer snapshot.'
     where id = v_running.id;
  end if;

  insert into public.dpwh_sync_runs (
    trigger, triggered_by, source_dataset, source_file, source_revision, source_snapshot_at, source_rows
  ) values (
    p_trigger,
    (select auth.uid()),
    p_source ->> 'source_dataset',
    p_source ->> 'source_file',
    p_source ->> 'source_revision',
    (p_source ->> 'source_snapshot_at')::timestamptz,
    (p_source ->> 'source_rows')::integer
  )
  returning * into v_run;
  return v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: apply one batch of normalized contracts (rows [p_row_start, p_row_end))
-- -----------------------------------------------------------------------------
-- Batches must arrive in order. A batch that was already applied (retry after
-- a lost response) is acknowledged without being applied twice.
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
  if (select count(distinct e ->> 'contract_id') from jsonb_array_elements(p_contracts) e) <> v_submitted
     or exists (select 1 from jsonb_array_elements(p_contracts) e where e ->> 'contract_id' is null) then
    raise exception 'Every contract in a batch needs a unique contract_id.' using errcode = '22023';
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
    'next_row', p_row_end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: finish a run
-- -----------------------------------------------------------------------------
-- 'succeeded' only when every source row was processed; then the cached
-- summary is refreshed. 'failed' keeps everything already applied (nothing
-- is rolled back or deleted) and records the error.
create or replace function public.dpwh_sync_finish(p_run_id uuid, p_status public.dpwh_sync_status, p_error text default null)
returns public.dpwh_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.dpwh_sync_runs;
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can run DPWH syncs.' using errcode = '42501';
  end if;
  if p_status = 'running' then
    raise exception 'Cannot finish a run as running.' using errcode = '22023';
  end if;

  select * into v_run from public.dpwh_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' then
    raise exception 'Sync run % is not running.', p_run_id using errcode = '55000';
  end if;
  if p_status = 'succeeded' and v_run.next_row <> v_run.source_rows then
    raise exception 'Run % processed % of % rows; cannot mark succeeded.', p_run_id, v_run.next_row, v_run.source_rows
      using errcode = '22023';
  end if;

  update public.dpwh_sync_runs
     set status = p_status, finished_at = now(), heartbeat_at = now(), error = left(p_error, 4000)
   where id = p_run_id
  returning * into v_run;

  if p_status = 'succeeded' then
    perform private.refresh_dpwh_directory_stats();
  end if;
  return v_run;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: record a sync that failed before it could start (e.g. source down)
-- -----------------------------------------------------------------------------
create or replace function public.dpwh_sync_log_failure(p_trigger text, p_error text, p_source jsonb default null)
returns public.dpwh_sync_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.dpwh_sync_runs;
begin
  if not private.can_run_dpwh_sync() then
    raise exception 'Only administrators or the server can run DPWH syncs.' using errcode = '42501';
  end if;
  insert into public.dpwh_sync_runs (
    trigger, triggered_by, status, source_dataset, source_file, source_revision, source_snapshot_at,
    source_rows, error, finished_at
  ) values (
    p_trigger, (select auth.uid()), 'failed',
    p_source ->> 'source_dataset', p_source ->> 'source_file', p_source ->> 'source_revision',
    (p_source ->> 'source_snapshot_at')::timestamptz, (p_source ->> 'source_rows')::integer,
    left(coalesce(p_error, 'Unknown error'), 4000), now()
  )
  returning * into v_run;
  return v_run;
end;
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to anon.
revoke execute on function public.dpwh_sync_begin(text, jsonb, uuid) from public, anon;
revoke execute on function public.dpwh_sync_apply_batch(uuid, integer, integer, jsonb, jsonb) from public, anon;
revoke execute on function public.dpwh_sync_finish(uuid, public.dpwh_sync_status, text) from public, anon;
revoke execute on function public.dpwh_sync_log_failure(text, text, jsonb) from public, anon;
grant execute on function public.dpwh_sync_begin(text, jsonb, uuid) to authenticated, service_role;
grant execute on function public.dpwh_sync_apply_batch(uuid, integer, integer, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.dpwh_sync_finish(uuid, public.dpwh_sync_status, text) to authenticated, service_role;
grant execute on function public.dpwh_sync_log_failure(text, text, jsonb) to authenticated, service_role;
