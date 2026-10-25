-- =============================================================================
-- LGU Tracker · Migration 3 · Authorization helpers and triggers
-- =============================================================================
-- Security model
--   * The caller's role comes ONLY from public.profiles.role. User-editable
--     auth metadata (raw_user_meta_data) is never trusted for authorization.
--   * Authorization helpers are SECURITY DEFINER so RLS policies can call them
--     without recursive policy evaluation. Each one has an empty search_path,
--     reads only the caller's own facts, and returns booleans or ids.
--   * "Guard" triggers (SECURITY INVOKER) whitelist the columns each role may
--     change. Row Level Security decides WHICH rows a user may touch; guards
--     decide WHICH COLUMNS. Guards are skipped for non-end-user sessions
--     (migrations, SQL editor, service role).
--   * Status history and the audit log are written by SECURITY DEFINER
--     triggers; end users have no write privileges on those tables.
--   * Attribution columns (created_by, updated_by, published_at, reviewed_by,
--     reviewed_at, handled_by, resolved_at, verified_by, verified_by_name,
--     completed_at, author_id, uploaded_by, assigned_by, decided_by,
--     is_decisive) are set by triggers for end users and cannot be supplied
--     by the client.
--   * Proposal outcomes (approved / rejected) are set only by
--     private.apply_proposal_decision when a decision is recorded.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Authorization helpers
-- -----------------------------------------------------------------------------

-- The caller's role, or NULL when signed out, without a profile, or deactivated.
create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active;
$$;

create or replace function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active;
$$;

create or replace function private.has_any_role(roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = any (roles), false);
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_any_role(array['super_admin', 'lgu_admin']::public.app_role[]);
$$;

-- LGU personnel: every role except contractor and citizen.
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_any_role(array[
    'super_admin', 'lgu_admin', 'planning_officer', 'budget_officer',
    'bac_member', 'project_engineer', 'council_member'
  ]::public.app_role[]);
$$;

-- True when the caller is assigned to the project directly or through their
-- organization.
create or replace function private.is_assigned_to_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_assignments a
    join public.profiles me
      on me.id = (select auth.uid())
     and me.is_active
    where a.project_id = p_project_id
      and (
        a.user_id = me.id
        or (a.organization_id is not null and a.organization_id = me.organization_id)
      )
  );
$$;

-- Who may edit a project's milestones and other content.
create or replace function private.can_edit_project_content(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[])
      or (
        private.has_any_role(array['project_engineer']::public.app_role[])
        and private.is_assigned_to_project(p_project_id)
      );
$$;

-- True when the caller holds one of the given assignment roles on the project,
-- directly or through their organization. 'monitor' and 'inspector'
-- assignments are how monitoring officers and inspectors get their scope.
create or replace function private.has_project_assignment(
  p_project_id uuid,
  p_roles public.assignment_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_assignments a
    join public.profiles me
      on me.id = (select auth.uid())
     and me.is_active
    where a.project_id = p_project_id
      and a.assignment_role = any (p_roles)
      and (
        a.user_id = me.id
        or (a.organization_id is not null and a.organization_id = me.organization_id)
      )
  );
$$;

-- Who may act on (moderate, resolve, publish, share) a report, including
-- private citizen concerns:
--   * administrators: every report;
--   * planning officers: reports on projects assigned to them (directly or via
--     their office) plus the intake queue of concerns not yet tied to any
--     project, which they triage and link;
--   * project engineers: reports on projects assigned to them.
create or replace function private.can_handle_report(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin()
      or (
        private.has_any_role(array['planning_officer']::public.app_role[])
        and (p_project_id is null or private.is_assigned_to_project(p_project_id))
      )
      or (
        p_project_id is not null
        and private.has_any_role(array['project_engineer']::public.app_role[])
        and private.is_assigned_to_project(p_project_id)
      );
$$;

-- Who may read a private citizen concern (the submitter is handled in RLS):
-- its handlers, monitors assigned to its project, and the project's assigned
-- contractor once a handler has explicitly shared it. Council members, budget
-- officers and BAC members get no access through their role alone.
create or replace function private.can_read_concern(p_project_id uuid, p_shared_with_contractor boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_handle_report(p_project_id)
      or (
        p_project_id is not null
        and private.has_project_assignment(p_project_id, array['monitor']::public.assignment_role[])
      )
      or (
        p_shared_with_contractor
        and p_project_id is not null
        and private.has_project_assignment(p_project_id, array['contractor']::public.assignment_role[])
      );
$$;

-- Who may file inspection reports (and inspection evidence) for a project.
create or replace function private.can_file_inspection(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_project_id is not null
     and (
       private.can_handle_report(p_project_id)
       or private.has_project_assignment(p_project_id, array['inspector']::public.assignment_role[])
     );
$$;

-- An active council member an administrator has authorized to decide proposals.
create or replace function private.is_proposal_decider()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role = 'council_member'
      and p.can_decide_proposals
  );
$$;

-- Who may upload a file for a given purpose and parent. The RLS policy also
-- requires the parent to be visible to the caller. Read-only roles have no
-- path here except the purpose their workflow needs.
create or replace function private.can_upload_attachment(
  p_purpose public.attachment_purpose,
  p_project_id uuid,
  p_proposal_id uuid,
  p_report_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() is not null
     and (
       private.is_admin()
       or case p_purpose
         when 'proposal_document' then
           private.has_any_role(array['planning_officer']::public.app_role[])
           and exists (
             select 1 from public.proposals pr
             where pr.id = p_proposal_id
               and pr.proposed_by = (select auth.uid())
               and pr.status not in ('approved', 'rejected'))
         when 'decision_document' then
           private.is_proposal_decider()
           and exists (
             select 1 from public.proposals pr
             where pr.id = p_proposal_id
               and pr.proposed_by <> (select auth.uid())
               and pr.status <> 'draft')
         when 'budget_document' then
           private.has_any_role(array['budget_officer']::public.app_role[])
         when 'procurement_document' then
           private.has_any_role(array['bac_member']::public.app_role[])
         when 'monitoring_evidence' then
           private.has_project_assignment(p_project_id, array['monitor']::public.assignment_role[])
         when 'inspection_evidence' then
           exists (
             select 1 from public.reports r
             where r.id = p_report_id
               and r.report_type = 'inspection_report'
               and private.can_file_inspection(r.project_id))
         when 'progress_evidence' then
           exists (
             select 1 from public.reports r
             where r.id = p_report_id
               and r.report_type = 'progress_report'
               and (private.is_assigned_to_project(r.project_id) or private.can_handle_report(r.project_id)))
         when 'concern_evidence' then
           exists (
             select 1 from public.reports r
             where r.id = p_report_id
               and r.report_type = 'citizen_concern'
               and r.submitted_by = (select auth.uid())
               and r.status = 'submitted')
         else false
       end
     );
$$;

-- Who may read every profile: administrators (user management) and planning
-- officers (assigning people to projects). Everyone else sees only their own.
create or replace function private.can_view_user_directory()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]);
$$;

-- Raises a permission error that lists the columns that were refused.
create or replace function private.assert_columns_allowed(
  changed text[],
  allowed text[],
  context text
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  refused text[];
begin
  select coalesce(array_agg(c), '{}') into refused
  from unnest(changed) as c
  where not (c = any (allowed));

  if cardinality(refused) > 0 then
    raise exception 'Permission denied: % may not change column(s) %', context, refused
      using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profile creation on sign-up. The role is ALWAYS 'citizen'; staff roles are
-- granted later by an administrator.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Guard: profiles
-- -----------------------------------------------------------------------------
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed text[];
  actor_role public.app_role := private.current_app_role();
begin
  if not private.is_end_user_request() then
    return new;
  end if;

  changed := array_remove(private.changed_columns(to_jsonb(old), to_jsonb(new)), 'updated_at');

  if private.is_admin() then
    perform private.assert_columns_allowed(
      changed,
      array['full_name', 'role', 'organization_id', 'position_title', 'barangay', 'is_active',
            'can_decide_proposals'],
      'administrator'
    );

    if new.id = (select auth.uid())
       and (new.role is distinct from old.role
            or new.is_active is distinct from old.is_active
            or new.can_decide_proposals is distinct from old.can_decide_proposals) then
      raise exception 'Permission denied: administrators cannot change their own role, active status, or decision authority'
        using errcode = '42501';
    end if;

    -- Only a super_admin may touch another administrator's account or grant
    -- an administrator role.
    if actor_role <> 'super_admin'
       and (old.role in ('super_admin', 'lgu_admin') or new.role in ('super_admin', 'lgu_admin'))
       and new.id <> (select auth.uid()) then
      raise exception 'Permission denied: only a super_admin can manage administrator accounts'
        using errcode = '42501';
    end if;

    return new;
  end if;

  -- Everyone else: self-service fields only (RLS already limits them to their
  -- own row).
  perform private.assert_columns_allowed(
    changed,
    array['full_name', 'position_title', 'barangay'],
    'profile owner'
  );
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

-- -----------------------------------------------------------------------------
-- Guard: projects (per-role column whitelist)
-- -----------------------------------------------------------------------------
create or replace function private.guard_project_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed text[];
  actor_role public.app_role;
  allowed text[];
begin
  if not private.is_end_user_request() then
    -- Trusted sessions may record a historical publication time.
    if new.visibility = 'published' and new.published_at is null then
      new.published_at := now();
    end if;
    return new;
  end if;

  -- For end users published_at is database-controlled: it records the first
  -- time the project became published and ignores any client-supplied value.
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.updated_by := (select auth.uid());
    new.published_at := case when new.visibility = 'published' then now() end;
    return new;
  end if;

  new.updated_by := (select auth.uid());
  new.published_at := old.published_at;
  if new.visibility = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  changed := private.changed_columns(to_jsonb(old), to_jsonb(new));
  changed := array_remove(array_remove(array_remove(changed, 'updated_at'), 'updated_by'), 'published_at');
  actor_role := private.current_app_role();

  -- id, created_at and created_by are never in any list, so nobody can change them.
  allowed := case
    when actor_role in ('super_admin', 'lgu_admin', 'planning_officer') then array[
      'reference_code', 'title', 'description', 'category', 'status', 'lifecycle_stage',
      'visibility', 'barangay', 'municipality', 'latitude', 'longitude', 'implementing_office',
      'contractor_or_partner', 'procurement_mode', 'allocated_budget', 'disbursed_budget',
      'progress_percentage', 'start_date', 'target_completion_date', 'actual_completion_date',
      'beneficiaries', 'image_url', 'image_caption', 'proposal_id']
    when actor_role = 'budget_officer' then array['allocated_budget', 'disbursed_budget']
    when actor_role = 'bac_member' then array['procurement_mode', 'contractor_or_partner', 'status', 'lifecycle_stage']
    when actor_role = 'project_engineer' then array[
      'status', 'lifecycle_stage', 'progress_percentage', 'actual_completion_date',
      'latitude', 'longitude', 'image_url', 'image_caption']
    else array[]::text[]
  end;

  perform private.assert_columns_allowed(changed, allowed, coalesce(actor_role::text, 'anonymous user'));
  return new;
end;
$$;

create trigger projects_guard_write
  before insert or update on public.projects
  for each row execute function private.guard_project_write();

-- -----------------------------------------------------------------------------
-- Project deletion: progress and inspection reports are historical records
-- that require a project (reports_project_required_check), so a project that
-- has any cannot be deleted; archive it instead. Citizen concerns survive a
-- deletion with project_id set to NULL. SECURITY DEFINER so the check sees
-- every report regardless of the caller's RLS.
-- -----------------------------------------------------------------------------
create or replace function private.prevent_project_delete_with_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.reports r
    where r.project_id = old.id
      and r.report_type <> 'citizen_concern'
  ) then
    raise exception 'Project % has progress or inspection reports and cannot be deleted; archive it instead',
      old.reference_code
      using errcode = '23001'; -- restrict_violation
  end if;
  return old;
end;
$$;

create trigger projects_prevent_delete_with_reports
  before delete on public.projects
  for each row execute function private.prevent_project_delete_with_reports();

-- -----------------------------------------------------------------------------
-- Milestone completion bookkeeping. For end users completed_at, verified_by
-- and verified_by_name are database-controlled: set from the acting user when
-- a milestone becomes completed, frozen while it stays completed, and cleared
-- when it is reopened. Trusted sessions (seed, service role) may record
-- historical completions.
-- -----------------------------------------------------------------------------
create or replace function private.track_milestone_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not new.is_completed then
    new.completed_at := null;
    new.verified_by := null;
    new.verified_by_name := null;
    return new;
  end if;

  if not private.is_end_user_request() then
    new.completed_at := coalesce(new.completed_at, now());
    new.verified_by := coalesce(new.verified_by, me);
    return new;
  end if;

  if tg_op = 'UPDATE' and old.is_completed then
    new.completed_at := old.completed_at;
    new.verified_by := old.verified_by;
    new.verified_by_name := old.verified_by_name;
    return new;
  end if;

  new.completed_at := now();
  new.verified_by := me;
  -- e.g. "Engr. M. Santos (CEO)"; the caller can always read their own profile.
  new.verified_by_name := (
    select left(
      coalesce(nullif(btrim(p.full_name), ''), 'LGU staff')
        || coalesce(' (' || nullif(btrim(p.position_title), '') || ')', ''),
      200)
    from public.profiles p
    where p.id = me
  );
  return new;
end;
$$;

create trigger project_milestones_track_completion
  before insert or update on public.project_milestones
  for each row execute function private.track_milestone_completion();

-- -----------------------------------------------------------------------------
-- Guard: proposals
-- -----------------------------------------------------------------------------
create or replace function private.guard_proposal_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed text[];
  me uuid := (select auth.uid());
  is_triager boolean := private.has_any_role(
    array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]);
begin
  if not private.is_end_user_request() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'New proposals must be draft or submitted' using errcode = '42501';
    end if;
    new.proposed_by := me;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_notes := null;
    new.submitted_at := case when new.status = 'submitted' then now() end;
    return new;
  end if;

  changed := array_remove(private.changed_columns(to_jsonb(old), to_jsonb(new)), 'updated_at');

  -- Outcomes are recorded only through public.proposal_decisions, which sets
  -- status, reviewed_by and reviewed_at (private.apply_proposal_decision).
  if old.status in ('approved', 'rejected') then
    raise exception 'Proposal decision is final; an administrator may record an override decision'
      using errcode = '42501';
  end if;
  if new.status in ('approved', 'rejected') then
    raise exception 'Approve or reject a proposal by recording a decision' using errcode = '42501';
  end if;

  -- Intake triage (under_review / returned) by planners and administrators,
  -- never on their own proposals; for those they follow the proposer rules.
  if is_triager and old.proposed_by <> me then
    perform private.assert_columns_allowed(changed, array['status', 'review_notes'], 'reviewer');
    if new.status = 'draft' then
      raise exception 'Reviewers cannot move a proposal back to draft; use returned' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.proposed_by = me then
    if old.status not in ('draft', 'returned') then
      raise exception 'Proposal can no longer be edited (status: %)', old.status using errcode = '42501';
    end if;
    perform private.assert_columns_allowed(
      changed,
      array['title', 'description', 'category', 'barangay', 'estimated_budget', 'organization_id', 'status'],
      'proposer'
    );
    if new.status not in ('draft', 'submitted') then
      raise exception 'Proposers may only save a draft or submit' using errcode = '42501';
    end if;
    if new.status = 'submitted' and old.status <> 'submitted' then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  raise exception 'Permission denied for proposal update' using errcode = '42501';
end;
$$;

create trigger proposals_guard_write
  before insert or update on public.proposals
  for each row execute function private.guard_proposal_write();

-- -----------------------------------------------------------------------------
-- Proposal decisions (Development Council approvals / rejections)
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER because it must lock and update the proposal past RLS and
-- the proposal guard. Inside a definer function current_user is the owner, so
-- is_end_user_request() cannot be used; a request made for a signed-in user
-- always carries auth.uid(), and only signed-in users have INSERT here.
--
-- Rules
--   * Authorized council members (private.is_proposal_decider) decide; an
--     administrator records an explicit override (is_override).
--   * Nobody decides their own proposal.
--   * The proposal row is locked FOR UPDATE, so concurrent decisions are
--     serialized: the first one on a submitted / under_review proposal is
--     decisive and sets its status; any later one is stored with
--     is_decisive = false and does not change the outcome.
--   * An override is always decisive and replaces the outcome.
-- -----------------------------------------------------------------------------
create or replace function private.apply_proposal_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target public.proposals;
begin
  if me is not null then
    new.decided_by := me;
    new.created_at := now();
    if new.is_override then
      if not private.is_admin() then
        raise exception 'Only an LGU administrator can record an override decision'
          using errcode = '42501';
      end if;
    elsif not private.is_proposal_decider() then
      raise exception 'Only authorized Development Council members can record proposal decisions'
        using errcode = '42501';
    end if;
  end if;

  select * into target from public.proposals where id = new.proposal_id for update;
  if not found then
    raise exception 'Proposal not found' using errcode = '42501';
  end if;
  if target.proposed_by = new.decided_by then
    raise exception 'Permission denied: you cannot decide your own proposal' using errcode = '42501';
  end if;

  if new.is_override then
    if target.status not in ('submitted', 'under_review', 'approved', 'rejected') then
      raise exception 'Proposal is not open for a decision (status: %)', target.status
        using errcode = '55000';
    end if;
    new.is_decisive := true;
  elsif target.status in ('submitted', 'under_review') then
    new.is_decisive := true;
  elsif target.status in ('approved', 'rejected') then
    new.is_decisive := false; -- recorded transparently; the outcome stands
  else
    raise exception 'Proposal is not open for a decision (status: %)', target.status
      using errcode = '55000';
  end if;

  if new.is_decisive then
    update public.proposals
       set status = new.decision::text::public.proposal_status,
           reviewed_by = new.decided_by,
           reviewed_at = new.created_at
     where id = target.id;
  end if;
  return new;
end;
$$;

create trigger proposal_decisions_apply
  before insert on public.proposal_decisions
  for each row execute function private.apply_proposal_decision();

-- -----------------------------------------------------------------------------
-- Guard: reports and concerns (moderation workflow)
-- -----------------------------------------------------------------------------
create or replace function private.guard_report_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed text[];
  me uuid := (select auth.uid());
begin
  if not private.is_end_user_request() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Every report starts private and unhandled, whoever submits it.
    new.submitted_by := me;
    new.status := 'submitted';
    new.is_public := false;
    new.shared_with_contractor := false;
    new.handled_by := null;
    new.resolution_notes := null;
    new.resolved_at := null;
    return new;
  end if;

  changed := array_remove(private.changed_columns(to_jsonb(old), to_jsonb(new)), 'updated_at');

  -- Handlers are authorized per report: engineers only for assigned projects.
  -- handled_by and resolved_at are not in the whitelist; this trigger sets them.
  if private.can_handle_report(old.project_id) then
    perform private.assert_columns_allowed(
      changed,
      array['status', 'is_public', 'shared_with_contractor', 'resolution_notes', 'project_id'],
      'report handler'
    );
    if new.project_id is distinct from old.project_id then
      if not private.can_handle_report(new.project_id) then
        raise exception 'Permission denied: you may not move a report to a project you do not handle'
          using errcode = '42501';
      end if;
      -- Sharing was granted to the old project's contractor, not the new one's.
      new.shared_with_contractor := false;
    end if;
    new.handled_by := me;
    if new.status in ('resolved', 'dismissed') and old.status not in ('resolved', 'dismissed') then
      new.resolved_at := now();
    elsif new.status not in ('resolved', 'dismissed') then
      new.resolved_at := null;
    end if;
    return new;
  end if;

  if old.submitted_by = me and old.status = 'submitted' then
    perform private.assert_columns_allowed(
      changed,
      array['title', 'body', 'barangay', 'latitude', 'longitude', 'reported_progress'],
      'report submitter'
    );
    return new;
  end if;

  raise exception 'Permission denied for report update' using errcode = '42501';
end;
$$;

create trigger reports_guard_write
  before insert or update on public.reports
  for each row execute function private.guard_report_write();

-- -----------------------------------------------------------------------------
-- Guard: comments
-- -----------------------------------------------------------------------------
create or replace function private.guard_comment_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  changed text[];
  allowed text[] := array[]::text[];
begin
  if not private.is_end_user_request() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.author_id := (select auth.uid());
    new.is_hidden := false;
    if new.visibility = 'internal' and not private.is_staff() then
      raise exception 'Only LGU staff can post internal comments' using errcode = '42501';
    end if;
    return new;
  end if;

  changed := array_remove(private.changed_columns(to_jsonb(old), to_jsonb(new)), 'updated_at');

  if old.author_id = (select auth.uid()) then
    allowed := allowed || array['body'];
  end if;
  if private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]) then
    allowed := allowed || array['is_hidden'];
  end if;

  perform private.assert_columns_allowed(changed, allowed, 'comment editor');
  return new;
end;
$$;

create trigger comments_guard_write
  before insert or update on public.comments
  for each row execute function private.guard_comment_write();

-- -----------------------------------------------------------------------------
-- Stamp the acting user on assignments and attachments
-- -----------------------------------------------------------------------------
create or replace function private.stamp_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_end_user_request() then
    new.assigned_by := (select auth.uid());
    -- Assignments grant access (including to private concerns), so a planner
    -- cannot grant it to themselves or to their own organization.
    if not private.is_admin()
       and (new.user_id = (select auth.uid())
            or (new.organization_id is not null and new.organization_id = private.current_org_id())) then
      raise exception 'Permission denied: you cannot assign yourself or your own organization to a project'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger project_assignments_stamp
  before insert on public.project_assignments
  for each row execute function private.stamp_assignment();

create or replace function private.stamp_attachment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_end_user_request() then
    new.uploaded_by := (select auth.uid());
    -- Only staff can publish files directly; others' uploads start private.
    if new.is_public and not private.is_staff() then
      new.is_public := false;
    end if;
  end if;
  return new;
end;
$$;

create trigger attachments_stamp
  before insert on public.attachments
  for each row execute function private.stamp_attachment();

-- -----------------------------------------------------------------------------
-- Project status history (append-only)
-- -----------------------------------------------------------------------------
create or replace function private.record_project_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.lifecycle_stage is distinct from old.lifecycle_stage then
    insert into public.project_status_history
      (project_id, from_status, to_status, from_stage, to_stage, note, changed_by)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      case when tg_op = 'UPDATE' then old.lifecycle_stage end,
      new.lifecycle_stage,
      nullif(current_setting('app.status_change_note', true), ''),
      (select auth.uid())
    );
  end if;
  return null;
end;
$$;

create trigger projects_record_status_change
  after insert or update of status, lifecycle_stage on public.projects
  for each row execute function private.record_project_status_change();

-- -----------------------------------------------------------------------------
-- Generic audit log (append-only)
-- -----------------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_image jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (table_name, record_id, action, actor_id, old_data, new_data)
  values (
    tg_table_name,
    (row_image ->> 'id')::uuid,
    tg_op,
    (select auth.uid()),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end;
$$;

create trigger organizations_audit after insert or update or delete on public.organizations
  for each row execute function private.audit_row_change();
create trigger organization_contacts_audit after insert or update or delete on public.organization_contacts
  for each row execute function private.audit_row_change();
create trigger project_milestones_audit after insert or update or delete on public.project_milestones
  for each row execute function private.audit_row_change();
create trigger proposal_decisions_audit after insert or update or delete on public.proposal_decisions
  for each row execute function private.audit_row_change();
create trigger attachments_audit after insert or update or delete on public.attachments
  for each row execute function private.audit_row_change();
create trigger profiles_audit after update or delete on public.profiles
  for each row execute function private.audit_row_change();
create trigger projects_audit after insert or update or delete on public.projects
  for each row execute function private.audit_row_change();
create trigger project_assignments_audit after insert or update or delete on public.project_assignments
  for each row execute function private.audit_row_change();
create trigger proposals_audit after update or delete on public.proposals
  for each row execute function private.audit_row_change();
create trigger reports_audit after update or delete on public.reports
  for each row execute function private.audit_row_change();

-- -----------------------------------------------------------------------------
-- RPC: change a project's status with an optional note in one transaction.
-- SECURITY INVOKER, so RLS and the column guard apply to the caller as usual.
-- -----------------------------------------------------------------------------
create or replace function public.change_project_status(
  p_project_id uuid,
  p_status public.project_status,
  p_stage public.lifecycle_stage default null,
  p_note text default null
)
returns public.projects
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.projects;
begin
  perform set_config('app.status_change_note', coalesce(left(p_note, 2000), ''), true);

  update public.projects
     set status = p_status,
         lifecycle_stage = coalesce(p_stage, lifecycle_stage)
   where id = p_project_id
  returning * into result;

  perform set_config('app.status_change_note', '', true);

  if result.id is null then
    raise exception 'Project not found or you are not allowed to update it'
      using errcode = '42501';
  end if;

  return result;
end;
$$;

revoke execute on function public.change_project_status(uuid, public.project_status, public.lifecycle_stage, text)
  from public, anon;
grant execute on function public.change_project_status(uuid, public.project_status, public.lifecycle_stage, text)
  to authenticated, service_role;
