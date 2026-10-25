-- =============================================================================
-- LGU Tracker · Migration 4 · Row Level Security, grants, and policies
-- =============================================================================
-- Access summary
--   anon (signed out)  read published projects, their milestones and status
--                      history, public reports/comments/attachments, and
--                      active organizations (no contact details). No writes.
--   citizen            the above, plus their own concerns and comments, and
--                      their own profile (self-service fields only).
--   contractor         the above, plus projects assigned to them or their
--                      organization; progress reports for those projects.
--   staff roles        read all projects, non-draft proposals and their
--                      decisions, assignments, progress/inspection reports,
--                      and organization contacts. Writes depend on role
--                      (guard triggers in migration 3).
--   private concerns   submitter; admins (all); planning officers (assigned
--                      projects + unlinked intake); engineers (assigned
--                      projects); 'monitor' assignees (read); the project's
--                      contractor once a handler shares it (read).
--                      Council, budget and BAC roles: no role-based access.
--   proposals          planners create and submit; planners/admins triage;
--                      authorized council members decide; admins override.
--   attachments        upload only for a purpose the caller's workflow allows
--                      (private.can_upload_attachment); private by default.
--   other profiles     only admins and planning officers
--                      (private.can_view_user_directory).
--   lgu/super admin    user management and the audit log.
--
-- Note: `(select auth.uid())` and `(select private.fn())` are used so that
-- Postgres evaluates them once per statement rather than once per row.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------
alter table public.organizations          enable row level security;
alter table public.organization_contacts  enable row level security;
alter table public.profiles              enable row level security;
alter table public.proposals              enable row level security;
alter table public.proposal_decisions     enable row level security;
alter table public.projects               enable row level security;
alter table public.project_milestones     enable row level security;
alter table public.project_assignments    enable row level security;
alter table public.reports                enable row level security;
alter table public.comments               enable row level security;
alter table public.project_status_history enable row level security;
alter table public.attachments            enable row level security;
alter table public.audit_log              enable row level security;

-- -----------------------------------------------------------------------------
-- Table privileges
-- -----------------------------------------------------------------------------
-- Defined explicitly instead of relying on Supabase's default grants. Each
-- role gets exactly the commands that some policy below allows; RLS then
-- decides which rows. A privilege without a matching policy returns no rows.
-- NOTE: Supabase's default privileges still apply to tables created by later
-- migrations, so every new table needs its own revoke/grant block.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on
  public.organizations,
  public.projects,
  public.project_milestones,
  public.reports,
  public.comments,
  public.project_status_history,
  public.attachments
to anon;

-- anon needs the privilege (not rows) on proposals because the comments and
-- attachments policies reference it in a subquery. There is no anon policy on
-- proposals, so RLS still returns zero rows to signed-out visitors.
grant select on public.proposals to anon;

grant select, insert, update, delete on
  public.organizations,
  public.organization_contacts,
  public.projects,
  public.project_milestones,
  public.proposals,
  public.reports,
  public.comments
to authenticated;
grant select, update         on public.profiles to authenticated; -- rows created by trigger
grant select, insert, delete on public.project_assignments, public.attachments to authenticated; -- no UPDATE policy
grant select, insert         on public.proposal_decisions to authenticated; -- append-only
grant select                 on public.project_status_history, public.audit_log to authenticated; -- written by triggers

-- service_role is the trusted server-side role (bypasses RLS by design). It is
-- never sent to browsers; see src/lib/supabase/env.ts.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Policies and guard triggers call the private helpers as the querying role,
-- so every role that reaches these tables needs USAGE/EXECUTE. The schema
-- stays out of the Data API (not in the exposed schemas), so none of these
-- functions can be called as an RPC.
grant usage on schema private to anon, authenticated, service_role;
revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create policy "organizations: read active, staff read all"
  on public.organizations for select
  to anon, authenticated
  using (is_active or (select private.is_staff()));

create policy "organizations: admins insert"
  on public.organizations for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "organizations: admins update"
  on public.organizations for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "organizations: admins delete"
  on public.organizations for delete
  to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- organization_contacts (not public: staff read, admins write)
-- -----------------------------------------------------------------------------
create policy "organization contacts: staff read"
  on public.organization_contacts for select
  to authenticated
  using ((select private.is_staff()));

create policy "organization contacts: admins insert"
  on public.organization_contacts for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "organization contacts: admins update"
  on public.organization_contacts for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "organization contacts: admins delete"
  on public.organization_contacts for delete
  to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- profiles (created by trigger; never inserted or deleted through the API)
-- -----------------------------------------------------------------------------
create policy "profiles: read own; admins and planners read all"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select private.can_view_user_directory()));

create policy "profiles: update own or admin"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create policy "projects: public read published; staff and assignees read all"
  on public.projects for select
  to anon, authenticated
  using (
    visibility = 'published'
    or (select private.is_staff())
    or private.is_assigned_to_project(id)
  );

create policy "projects: planners and admins insert"
  on public.projects for insert
  to authenticated
  with check (
    (select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]))
  );

-- Which columns each role may change is enforced by private.guard_project_write.
create policy "projects: authorized roles update"
  on public.projects for update
  to authenticated
  using (
    (select private.has_any_role(array[
      'super_admin', 'lgu_admin', 'planning_officer', 'budget_officer', 'bac_member'
    ]::public.app_role[]))
    or (
      (select private.has_any_role(array['project_engineer']::public.app_role[]))
      and private.is_assigned_to_project(id)
    )
  )
  with check (
    (select private.has_any_role(array[
      'super_admin', 'lgu_admin', 'planning_officer', 'budget_officer', 'bac_member'
    ]::public.app_role[]))
    or (
      (select private.has_any_role(array['project_engineer']::public.app_role[]))
      and private.is_assigned_to_project(id)
    )
  );

-- Published or archived projects are kept for the audit trail; archive instead.
create policy "projects: admins delete drafts"
  on public.projects for delete
  to authenticated
  using ((select private.is_admin()) and visibility = 'draft');

-- -----------------------------------------------------------------------------
-- project_milestones (visibility follows the parent project's RLS)
-- -----------------------------------------------------------------------------
create policy "milestones: read when project is visible"
  on public.project_milestones for select
  to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

create policy "milestones: editors insert"
  on public.project_milestones for insert
  to authenticated
  with check (private.can_edit_project_content(project_id));

create policy "milestones: editors update"
  on public.project_milestones for update
  to authenticated
  using (private.can_edit_project_content(project_id))
  with check (private.can_edit_project_content(project_id));

create policy "milestones: editors delete"
  on public.project_milestones for delete
  to authenticated
  using (private.can_edit_project_content(project_id));

-- -----------------------------------------------------------------------------
-- project_assignments (insert/delete only; reassign = delete + insert)
-- -----------------------------------------------------------------------------
create policy "assignments: staff read all; assignees read own"
  on public.project_assignments for select
  to authenticated
  using (
    (select private.is_staff())
    or user_id = (select auth.uid())
    or (organization_id is not null and organization_id = (select private.current_org_id()))
  );

create policy "assignments: planners and admins insert"
  on public.project_assignments for insert
  to authenticated
  with check (
    (select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]))
  );

create policy "assignments: planners and admins delete"
  on public.project_assignments for delete
  to authenticated
  using (
    (select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]))
  );

-- -----------------------------------------------------------------------------
-- proposals
-- -----------------------------------------------------------------------------
create policy "proposals: read own; staff read non-drafts"
  on public.proposals for select
  to authenticated
  using (
    proposed_by = (select auth.uid())
    or ((select private.is_staff()) and status <> 'draft')
  );

create policy "proposals: planners create own"
  on public.proposals for insert
  to authenticated
  with check (
    proposed_by = (select auth.uid())
    and (select private.has_any_role(array['planning_officer']::public.app_role[]))
  );

-- Status transitions and editable columns are enforced by private.guard_proposal_write.
-- Approval and rejection happen only through proposal_decisions.
create policy "proposals: proposer or reviewer update"
  on public.proposals for update
  to authenticated
  using (
    proposed_by = (select auth.uid())
    or (select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]))
  )
  with check (
    proposed_by = (select auth.uid())
    or (select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]))
  );

create policy "proposals: proposer deletes own draft"
  on public.proposals for delete
  to authenticated
  using (proposed_by = (select auth.uid()) and status = 'draft');

-- -----------------------------------------------------------------------------
-- proposal_decisions (append-only; no UPDATE or DELETE policy or privilege)
-- -----------------------------------------------------------------------------
-- Visible to whoever can see the proposal (its proposer and staff).
create policy "proposal decisions: read when proposal visible"
  on public.proposal_decisions for select
  to authenticated
  using (exists (select 1 from public.proposals pr where pr.id = proposal_id));

-- private.apply_proposal_decision re-checks all of this and enforces the
-- self-decision and first-decision-wins rules.
create policy "proposal decisions: authorized deciders and admin overrides"
  on public.proposal_decisions for insert
  to authenticated
  with check (
    decided_by = (select auth.uid())
    and exists (
      select 1 from public.proposals pr
      where pr.id = proposal_id and pr.proposed_by <> (select auth.uid()))
    and (
      (is_override and (select private.is_admin()))
      or (not is_override and (select private.is_proposal_decider()))
    )
  );

-- -----------------------------------------------------------------------------
-- reports and concerns (moderated: private until staff set is_public)
-- -----------------------------------------------------------------------------
-- Private citizen concerns: submitter plus private.can_read_concern. Progress
-- and inspection reports: all staff (oversight) and the project's assignees.
create policy "reports: public read published; submitter, concern scope, staff, assignees read"
  on public.reports for select
  to anon, authenticated
  using (
    (
      is_public
      and (project_id is null or exists (select 1 from public.projects p where p.id = project_id))
    )
    or submitted_by = (select auth.uid())
    or (
      report_type = 'citizen_concern'
      and private.can_read_concern(project_id, shared_with_contractor)
    )
    or (
      report_type <> 'citizen_concern'
      and (
        (select private.is_staff())
        or (project_id is not null and private.is_assigned_to_project(project_id))
      )
    )
  );

create policy "reports: signed-in users submit"
  on public.reports for insert
  to authenticated
  with check (
    submitted_by = (select auth.uid())
    and (select private.current_app_role()) is not null
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id))
    and (
      report_type = 'citizen_concern'
      or (
        report_type = 'progress_report'
        and (
          private.is_assigned_to_project(project_id)
          or private.can_handle_report(project_id)
        )
      )
      or (
        report_type = 'inspection_report'
        and private.can_file_inspection(project_id)
      )
    )
  );

-- Who may change which columns is enforced by private.guard_report_write.
-- The WITH CHECK also stops a handler from moving a report to a project they
-- do not handle.
create policy "reports: submitter or handler update"
  on public.reports for update
  to authenticated
  using (
    submitted_by = (select auth.uid())
    or private.can_handle_report(project_id)
  )
  with check (
    submitted_by = (select auth.uid())
    or private.can_handle_report(project_id)
  );

create policy "reports: admins delete"
  on public.reports for delete
  to authenticated
  using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- comments (parent visibility follows the parent table's RLS)
-- -----------------------------------------------------------------------------
create policy "comments: read when parent visible"
  on public.comments for select
  to anon, authenticated
  using (
    (
      (project_id is not null and exists (select 1 from public.projects p where p.id = project_id))
      or (proposal_id is not null and exists (select 1 from public.proposals pr where pr.id = proposal_id))
      or (report_id is not null and exists (select 1 from public.reports r where r.id = report_id))
    )
    and (
      author_id = (select auth.uid())
      or (select private.is_staff())
      or (visibility = 'public' and not is_hidden)
    )
  );

create policy "comments: signed-in users comment on visible records"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.current_app_role()) is not null
    and (visibility = 'public' or (select private.is_staff()))
    and (
      (project_id is not null and exists (select 1 from public.projects p where p.id = project_id))
      or (proposal_id is not null and exists (select 1 from public.proposals pr where pr.id = proposal_id))
      or (report_id is not null and exists (select 1 from public.reports r where r.id = report_id))
    )
  );

-- Authors edit their text; moderators toggle is_hidden (private.guard_comment_write).
create policy "comments: author or moderator update"
  on public.comments for update
  to authenticated
  using (
    author_id = (select auth.uid())
    or (select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]))
  )
  with check (
    author_id = (select auth.uid())
    or (select private.has_any_role(array['super_admin', 'lgu_admin', 'planning_officer']::public.app_role[]))
  );

create policy "comments: author or admin delete"
  on public.comments for delete
  to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- project_status_history (read-only through the API)
-- -----------------------------------------------------------------------------
create policy "status history: read when project visible"
  on public.project_status_history for select
  to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id));

-- -----------------------------------------------------------------------------
-- attachments (metadata; no UPDATE: delete and re-upload instead)
-- -----------------------------------------------------------------------------
create policy "attachments: read public, own, staff, assignees"
  on public.attachments for select
  to anon, authenticated
  using (
    (
      (project_id is not null and exists (select 1 from public.projects p where p.id = project_id))
      or (proposal_id is not null and exists (select 1 from public.proposals pr where pr.id = proposal_id))
      or (report_id is not null and exists (select 1 from public.reports r where r.id = report_id))
    )
    and (
      is_public
      or uploaded_by = (select auth.uid())
      or (select private.is_staff())
      or (project_id is not null and private.is_assigned_to_project(project_id))
    )
  );

-- No blanket staff upload: the purpose must match the caller's workflow and
-- scope (private.can_upload_attachment), and the parent must be visible.
create policy "attachments: upload for an authorized purpose on a visible parent"
  on public.attachments for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and private.can_upload_attachment(purpose, project_id, proposal_id, report_id)
    and (
      (project_id is not null and exists (select 1 from public.projects p where p.id = project_id))
      or (proposal_id is not null and exists (select 1 from public.proposals pr where pr.id = proposal_id))
      or (report_id is not null and exists (select 1 from public.reports r where r.id = report_id))
    )
  );

create policy "attachments: uploader or admin delete"
  on public.attachments for delete
  to authenticated
  using (uploaded_by = (select auth.uid()) or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- audit_log (read-only, admins only)
-- -----------------------------------------------------------------------------
create policy "audit log: admins read"
  on public.audit_log for select
  to authenticated
  using ((select private.is_admin()));
