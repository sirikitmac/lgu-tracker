-- =============================================================================
-- LGU Tracker · Migration · Reports on directory records (DPWH / NEP / DILG)
-- =============================================================================
-- public.reports was built for the local `projects` table (project_id uuid).
-- The directory people actually browse is different: DPWH contracts, NEP
-- proposals and DILG SubayBAYAN projects, each identified by (source, id) in
-- its own table. This adds a structured way to report on one of those records
-- WITHOUT a foreign key to it (those tables are re-imported and rows can
-- change), by storing a reference plus a snapshot of what the reporter saw.
--
-- Who may report: only signed-in, active accounts. Already enforced by the
-- existing "reports: signed-in users submit" policy
-- (private.current_app_role() is not null, submitted_by = auth.uid()). Nothing
-- here loosens it, and anon has no INSERT privilege at all.
--
-- Visibility: unchanged. Every report starts private (guard_report_write) and
-- is only visible to its submitter and staff until staff publish it. That
-- matters for category 'possible_irregularity': nothing is shown publicly
-- until a person at the LGU has reviewed it.
-- =============================================================================

create type public.report_category as enum (
  'incorrect_information',   -- what the page says does not match reality
  'not_found_on_site',       -- the project could not be found where listed
  'delayed_or_stalled',      -- work stopped or is far behind
  'poor_quality',            -- defects, substandard work
  'safety_hazard',           -- danger to the public
  'possible_irregularity',   -- cost, procurement or other irregularity
  'other'
);

alter table public.reports
  add column report_category public.report_category,
  -- Which directory record this is about. record_source is the directory's
  -- `source` id (dpwh_contracts, dpwh_nep_2027, subaybayan_lgsf, ...).
  add column record_source   text check (record_source ~ '^[a-z][a-z0-9_]{2,49}$'),
  add column record_id       text check (char_length(record_id) between 1 and 120),
  -- Title and key fields AS THE REPORTER SAW THEM, copied server-side at
  -- submission so the report stays meaningful after a re-import.
  add column record_title    text check (char_length(record_title) between 1 and 500),
  add column record_snapshot jsonb
    check (jsonb_typeof(record_snapshot) = 'object' and octet_length(record_snapshot::text) <= 4096),
  add column observed_on     date,
  add column location_note   text check (char_length(location_note) <= 300);

-- Either not about a directory record at all, or fully described.
alter table public.reports
  add constraint reports_record_link_check check (
    (record_source is null and record_id is null and record_title is null and record_snapshot is null)
    or (
      record_source is not null and record_id is not null
      and record_title is not null and record_snapshot is not null
      and report_type = 'citizen_concern'
      and project_id is null
      and report_category is not null
    )
  );

create index reports_record_idx
  on public.reports (record_source, record_id)
  where record_source is not null;

-- -----------------------------------------------------------------------------
-- Guard: rate limit and basic sanity for directory-record reports.
-- Runs for end users only (migrations, SQL editor, service role skip it).
-- Fires after reports_guard_write (alphabetical order), which has already
-- forced status = submitted, is_public = false and submitted_by = auth.uid().
-- -----------------------------------------------------------------------------
create or replace function private.guard_record_report()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent integer;
begin
  if new.record_source is null or not private.is_end_user_request() then
    return new;
  end if;

  if new.observed_on is not null and new.observed_on > current_date + 1 then
    raise exception 'The observation date cannot be in the future'
      using errcode = '22023';
  end if;

  -- Basic abuse brake: 10 directory reports per account per rolling 24 hours.
  select count(*) into recent
  from public.reports r
  where r.submitted_by = (select auth.uid())
    and r.record_source is not null
    and r.created_at > now() - interval '24 hours';

  if recent >= 10 then
    raise exception 'Daily report limit reached'
      using errcode = '53400';
  end if;

  return new;
end;
$$;

create trigger reports_record_guard
  before insert on public.reports
  for each row execute function private.guard_record_report();

revoke execute on function private.guard_record_report() from public;
grant execute on function private.guard_record_report() to anon, authenticated, service_role;
