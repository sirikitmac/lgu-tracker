-- =============================================================================
-- LGU Tracker · Migration · Notifications (inbox) and the report workflow
-- =============================================================================
-- Adds:
--   1. public.notifications   a per-account inbox. Rows are written ONLY by
--                             database triggers / trusted functions, never by
--                             a browser. A person can read, mark read and
--                             delete their own rows and nothing else.
--   2. public.report_events   the timeline of a report (submitted, status
--                             changes, the handler's note) shown to the
--                             submitter and to the people who handle it.
--   3. reports.ref_no         a short human number (RPT-00042) for reports.
--   4. Triggers that notify the right people:
--        new report       -> submitter (receipt) and the staff who handle it
--        status change    -> submitter
--        role requested   -> administrators (only after the e-mail is confirmed)
--        role decided     -> the person who asked
--   5. Declining a request = an administrator clears profiles.requested_role
--      and sets account_type back to citizen (both already allowed by
--      guard_profile_update); the person is told.
--   6. public.create_system_alert()  for technical alerts (failed imports...),
--      callable only with the service role.
--
-- Notifications are short and carry no report details beyond the public record's
-- title and the handler's note addressed to the submitter. The report body,
-- location and photos stay in public.reports behind its existing RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Report numbers and a queue index
-- -----------------------------------------------------------------------------
alter table public.reports
  add column ref_no bigint generated always as identity;

create unique index reports_ref_no_key on public.reports (ref_no);
create index reports_queue_idx on public.reports (status, created_at desc);

create type public.notification_kind as enum (
  'report_received',  -- your report was filed
  'report_new',       -- staff: a report is waiting for review
  'report_update',    -- your report changed status
  'role_requested',   -- administrators: someone asked for a role
  'role_decided',     -- your role request was decided / your role changed
  'system'            -- technical alerts for administrators
);

-- -----------------------------------------------------------------------------
-- Small helpers
-- -----------------------------------------------------------------------------
create or replace function private.role_label(r public.app_role)
returns text
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'super_admin'      then 'Super Administrator'
    when 'lgu_admin'        then 'LGU Administrator'
    when 'planning_officer' then 'Planning Officer'
    when 'budget_officer'   then 'Budget Officer'
    when 'bac_member'       then 'BAC Member'
    when 'project_engineer' then 'Project Engineer'
    when 'council_member'   then 'Council Member'
    when 'contractor'       then 'Contractor'
    else 'Citizen'
  end;
$$;

-- Writes one inbox row. Trusted code only: execute is not granted to anyone.
create or replace function private.notify(
  p_recipient uuid,
  p_kind      public.notification_kind,
  p_title     text,
  p_body      text default null,
  p_link      text default null,
  p_report    uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, kind, title, body, link, report_id)
  select p.id, p_kind, left(p_title, 120), left(p_body, 300), p_link, p_report
  from public.profiles p
  where p.id = p_recipient and p.is_active;
end;
$$;

revoke execute on function private.notify(uuid, public.notification_kind, text, text, text, uuid) from public;

-- -----------------------------------------------------------------------------
-- public.notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind         public.notification_kind not null,
  title        text not null check (char_length(title) between 1 and 120),
  body         text check (char_length(body) <= 300),
  -- An in-app path only ("/reports/..."), never an absolute or protocol-relative URL.
  link         text check (link ~ '^/($|[^/\\])' and char_length(link) <= 200),
  report_id    uuid references public.reports (id) on delete cascade,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

-- Defined explicitly: Supabase's default privileges would otherwise hand
-- anon/authenticated full access to a new table.
revoke all on public.notifications from public, anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.notifications to service_role;

create policy "notifications: read own"
  on public.notifications for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "notifications: mark own read"
  on public.notifications for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "notifications: delete own"
  on public.notifications for delete
  to authenticated
  using (recipient_id = (select auth.uid()));

-- Live updates for the bell (postgres_changes honours the policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- public.report_events
-- -----------------------------------------------------------------------------
create table public.report_events (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  kind        text not null check (kind in ('submitted', 'status_changed')),
  from_status public.report_status,
  to_status   public.report_status,
  note        text check (char_length(note) <= 2000),
  created_at  timestamptz not null default now()
);

create index report_events_report_idx on public.report_events (report_id, created_at);

alter table public.report_events enable row level security;

revoke all on public.report_events from public, anon, authenticated;
grant select on public.report_events to authenticated;
grant select, insert, update, delete on public.report_events to service_role;

create policy "report events: submitter and handlers read"
  on public.report_events for select
  to authenticated
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_events.report_id
        and (r.submitted_by = (select auth.uid()) or private.can_handle_report(r.project_id))
    )
  );

-- -----------------------------------------------------------------------------
-- Who handles a report (so they hear about it)
-- -----------------------------------------------------------------------------
create or replace function private.report_handlers(p_project_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.is_active
    and (
      p.role in ('super_admin', 'lgu_admin')
      or (p.role = 'planning_officer' and p_project_id is null)
      or (
        p.role in ('planning_officer', 'project_engineer')
        and p_project_id is not null
        and exists (
          select 1 from public.project_assignments a
          where a.project_id = p_project_id
            and (a.user_id = p.id or (a.organization_id is not null and a.organization_id = p.organization_id))
        )
      )
    );
$$;

revoke execute on function private.report_handlers(uuid) from public;

-- -----------------------------------------------------------------------------
-- New report: timeline entry, receipt for the submitter, heads-up for handlers.
-- Notifications are sent for requests made by a signed-in person (the app).
-- Bulk imports with the service role stay quiet.
-- -----------------------------------------------------------------------------
create or replace function private.after_report_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  what text := left(coalesce(new.record_title, new.title), 140);
  cat  text := initcap(replace(coalesce(new.report_category::text, 'concern'), '_', ' '));
  h    uuid;
begin
  insert into public.report_events (report_id, actor_id, kind, to_status)
  values (new.id, new.submitted_by, 'submitted', new.status);

  if (select auth.uid()) is null then
    return new;
  end if;

  perform private.notify(
    new.submitted_by, 'report_received', 'Report received',
    what || '. Staff will review it and you will hear back here.',
    '/my-reports/' || new.id, new.id
  );

  for h in select * from private.report_handlers(new.project_id) loop
    continue when h = new.submitted_by;
    perform private.notify(
      h, 'report_new', 'New report to review', cat || ': ' || what,
      '/reports/' || new.id, new.id
    );
  end loop;

  return new;
end;
$$;

create trigger reports_after_insert
  after insert on public.reports
  for each row execute function private.after_report_insert();

-- -----------------------------------------------------------------------------
-- Status change: timeline entry and a note for the submitter.
-- -----------------------------------------------------------------------------
create or replace function private.after_report_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  note  text;
  head  text;
begin
  note := case
    when new.resolution_notes is distinct from old.resolution_notes
      or new.status in ('resolved', 'dismissed') then new.resolution_notes
  end;

  insert into public.report_events (report_id, actor_id, kind, from_status, to_status, note)
  values (new.id, actor, 'status_changed', old.status, new.status, note);

  -- Nothing to tell the submitter when they made the change themselves or
  -- when it came from SQL / the service role.
  if actor is null or actor = new.submitted_by then
    return new;
  end if;

  head := case new.status
    when 'acknowledged' then 'Staff received your report'
    when 'in_review'    then 'Your report is being reviewed'
    when 'resolved'     then 'Your report was resolved'
    when 'dismissed'    then 'Your report was closed'
    else 'Your report is back in the queue'
  end;

  perform private.notify(
    new.submitted_by, 'report_update', head,
    left(coalesce(new.record_title, new.title), 100)
      || case when note is not null then ': ' || note else '' end,
    '/my-reports/' || new.id, new.id
  );
  return new;
end;
$$;

create trigger reports_after_status_change
  after update of status on public.reports
  for each row
  when (old.status is distinct from new.status)
  execute function private.after_report_status_change();

-- -----------------------------------------------------------------------------
-- Role requests
-- -----------------------------------------------------------------------------
-- Tell administrators that someone asked for a role (or signed up as a
-- technical account). Super administrators decide admin-level requests, so only
-- they hear about those.
create or replace function private.announce_role_request(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
  who text;
  what text;
  admin_level boolean;
  a uuid;
begin
  select * into p from public.profiles where id = p_profile;
  if not found or p.role <> 'citizen' then
    return;
  end if;
  if p.requested_role is null and p.account_type = 'citizen' then
    return;
  end if;

  who := coalesce(nullif(btrim(p.full_name), ''), 'A new account');
  -- Administrator roles, and technical accounts, are for a super administrator.
  admin_level := coalesce(p.requested_role in ('super_admin', 'lgu_admin'), false)
    or (p.requested_role is null and p.account_type = 'technical_developer');
  what := case
    when p.requested_role is not null then 'Asked to be ' || private.role_label(p.requested_role)
    when p.account_type = 'technical_developer' then 'Signed up as a technical / developer account'
    else 'Signed up as an organization employee'
  end || coalesce(' at ' || p.claimed_organization, '');

  for a in
    select id from public.profiles
    where is_active
      and (role = 'super_admin' or (role = 'lgu_admin' and not admin_level))
  loop
    perform private.notify(a, 'role_requested', who || ' needs a role', what, '/users');
  end loop;
end;
$$;

revoke execute on function private.announce_role_request(uuid) from public;

-- At sign-up, only when the e-mail is already confirmed (otherwise it waits for
-- the confirmation below, so unconfirmed throwaway sign-ups never ping anyone).
create or replace function private.profile_role_request_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users u where u.id = new.id and u.email_confirmed_at is not null) then
    perform private.announce_role_request(new.id);
  end if;
  return new;
end;
$$;

create trigger profiles_role_request_on_insert
  after insert on public.profiles
  for each row
  when (new.requested_role is not null or new.account_type <> 'citizen')
  execute function private.profile_role_request_on_insert();

create or replace function private.profile_role_request_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.announce_role_request(new.id);
  return new;
end;
$$;

create trigger auth_users_role_request_on_confirm
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function private.profile_role_request_on_confirm();

-- Tell the person what was decided.
create or replace function private.after_profile_role_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    perform private.notify(
      new.id, 'role_decided',
      case when new.role = 'citizen' then 'Your role was changed to Citizen'
           else 'Your role is now ' || private.role_label(new.role) end,
      case when new.role = 'citizen' then 'You can still browse every project and send reports.'
           else 'Your workspace now shows the tabs for this role.' end,
      '/inbox'
    );
  elsif (old.requested_role is not null and new.requested_role is null)
     or (old.account_type <> 'citizen' and new.account_type = 'citizen') then
    perform private.notify(
      new.id, 'role_decided', 'Role request not approved',
      'An administrator reviewed your request. You can keep using LGU Tracker as a ' || lower(private.role_label(new.role)) || '.',
      '/inbox'
    );
  end if;
  return new;
end;
$$;

create trigger profiles_after_role_decision
  after update of role, requested_role, account_type on public.profiles
  for each row
  when (old.role is distinct from new.role
        or old.requested_role is distinct from new.requested_role
        or old.account_type is distinct from new.account_type)
  execute function private.after_profile_role_decision();

-- -----------------------------------------------------------------------------
-- Technical alerts (failed imports, sync problems...) for administrators.
-- Service role only; call it from scripts and server-side jobs.
-- -----------------------------------------------------------------------------
create or replace function public.create_system_alert(
  p_title text,
  p_body  text default null,
  p_link  text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a uuid;
  n integer := 0;
begin
  for a in select id from public.profiles where is_active and role in ('super_admin', 'lgu_admin') loop
    perform private.notify(a, 'system', p_title, p_body, p_link);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.create_system_alert(text, text, text) from public, anon, authenticated;
grant execute on function public.create_system_alert(text, text, text) to service_role;
