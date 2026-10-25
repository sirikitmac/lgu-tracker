-- =============================================================================
-- LGU Tracker · Migration 2 · Tables
-- =============================================================================
-- Naming: snake_case columns; the app maps rows to the camelCase LGUProject
-- shape in src/lib/supabase/projectMapper.ts.
-- Every table gets Row Level Security in migration 4. Until then, nothing in
-- this file is reachable through the Data API in a meaningful way.
-- Retention: user-authored records (proposals, reports, comments, attachments)
-- reference profiles with ON DELETE RESTRICT so history is never lost by
-- deleting an account. Offboard by deactivating (see supabase/SECURITY_NOTES.md).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- organizations: LGU offices, contractor firms, barangays, partners, council
-- -----------------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique check (char_length(name) between 2 and 200),
  short_name    text check (char_length(short_name) <= 40),
  org_type      public.organization_type not null,
  barangay      text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- organization_contacts: non-public contact details, kept apart from
-- organizations (which is publicly readable) so RLS can restrict them to staff.
-- -----------------------------------------------------------------------------
create table public.organization_contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  contact_email   text check (char_length(contact_email) <= 320),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- profiles: one row per auth.users row, created by trigger on sign-up
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null default '' check (char_length(full_name) <= 200),
  role            public.app_role not null default 'citizen',
  organization_id uuid references public.organizations (id) on delete set null,
  position_title  text check (char_length(position_title) <= 200),
  barangay        text,
  is_active       boolean not null default true,
  -- Development Council decision authority; set only by administrators and
  -- effective only together with role = 'council_member'.
  can_decide_proposals boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_organization_id_idx on public.profiles (organization_id);
create index profiles_role_idx on public.profiles (role);

-- -----------------------------------------------------------------------------
-- proposals: project proposals submitted for review / AIP prioritization
-- (created before projects so projects.proposal_id can reference it)
-- -----------------------------------------------------------------------------
create table public.proposals (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 3 and 300),
  description      text not null default '',
  category         public.project_category not null,
  barangay         text not null,
  estimated_budget numeric(15, 2) check (estimated_budget >= 0),
  status           public.proposal_status not null default 'draft',
  proposed_by      uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  organization_id  uuid references public.organizations (id) on delete set null,
  submitted_at     timestamptz,
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  review_notes     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index proposals_proposed_by_idx on public.proposals (proposed_by);
create index proposals_status_idx on public.proposals (status);

-- -----------------------------------------------------------------------------
-- proposal_decisions: append-only record of formal approvals/rejections.
-- The first decision on an open proposal is decisive and sets its status;
-- later decisions are kept (is_decisive = false) without changing the outcome.
-- An administrator override (is_override) is always decisive. Written through
-- private.apply_proposal_decision; never updated or deleted.
-- -----------------------------------------------------------------------------
create table public.proposal_decisions (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete restrict,
  decision    public.proposal_decision_type not null,
  reason      text not null check (char_length(btrim(reason)) between 5 and 5000),
  is_override boolean not null default false,
  is_decisive boolean not null default false, -- set by trigger
  decided_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create index proposal_decisions_proposal_idx on public.proposal_decisions (proposal_id, created_at);
create index proposal_decisions_decided_by_idx on public.proposal_decisions (decided_by);

-- -----------------------------------------------------------------------------
-- projects: the core public record (maps to LGUProject)
-- -----------------------------------------------------------------------------
create table public.projects (
  id                     uuid primary key default gen_random_uuid(),
  reference_code         text not null unique check (char_length(reference_code) between 3 and 50),
  title                  text not null check (char_length(title) between 3 and 300),
  description            text not null default '',
  category               public.project_category not null,
  status                 public.project_status not null default 'planned',
  lifecycle_stage        public.lifecycle_stage not null default 'planning',
  visibility             public.project_visibility not null default 'draft',
  barangay               text not null,
  municipality           text not null default 'Iligan City',
  latitude               double precision,
  longitude              double precision,
  implementing_office    text not null default '',
  contractor_or_partner  text not null default '',
  procurement_mode       text not null default '',
  allocated_budget       numeric(15, 2) not null default 0 check (allocated_budget >= 0),
  disbursed_budget       numeric(15, 2) not null default 0 check (disbursed_budget >= 0),
  progress_percentage    smallint not null default 0 check (progress_percentage between 0 and 100),
  start_date             date,
  target_completion_date date,
  actual_completion_date date,
  beneficiaries          text not null default '',
  image_url              text,
  image_caption          text,
  proposal_id            uuid references public.proposals (id) on delete set null,
  published_at           timestamptz,
  created_by             uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint projects_valid_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint projects_dates_order_check check (
    start_date is null or target_completion_date is null
    or target_completion_date >= start_date
  )
);

create index projects_visibility_idx on public.projects (visibility);
create index projects_status_idx on public.projects (status);
create index projects_barangay_idx on public.projects (barangay);
create index projects_target_completion_idx on public.projects (target_completion_date);
create index projects_proposal_id_idx on public.projects (proposal_id);

-- -----------------------------------------------------------------------------
-- project_milestones (maps to ProjectMilestone)
-- -----------------------------------------------------------------------------
create table public.project_milestones (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  title            text not null check (char_length(title) between 2 and 300),
  target_date      date,
  sort_order       integer not null default 0,
  is_completed     boolean not null default false,
  completed_at     timestamptz,
  verified_by      uuid references public.profiles (id) on delete set null,
  verified_by_name text, -- display name shown publicly (e.g. "Engr. M. Santos (CEO)")
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index project_milestones_project_id_idx on public.project_milestones (project_id, sort_order);

-- -----------------------------------------------------------------------------
-- project_assignments: who works on a project. Drives contractor/engineer
-- access in RLS. Exactly one of user_id / organization_id is set; assigning an
-- organization grants access to every active member of that organization.
-- -----------------------------------------------------------------------------
create table public.project_assignments (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  assignment_role public.assignment_role not null,
  assigned_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint project_assignments_one_assignee_check
    check (num_nonnulls(user_id, organization_id) = 1)
);

create unique index project_assignments_user_unique
  on public.project_assignments (project_id, user_id, assignment_role) where user_id is not null;
create unique index project_assignments_org_unique
  on public.project_assignments (project_id, organization_id, assignment_role) where organization_id is not null;
create index project_assignments_user_id_idx on public.project_assignments (user_id);
create index project_assignments_org_id_idx on public.project_assignments (organization_id);

-- -----------------------------------------------------------------------------
-- reports: citizen concerns, contractor progress reports, inspection reports
-- Citizen concerns are private to the submitter + staff until staff publish.
-- -----------------------------------------------------------------------------
create table public.reports (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid references public.projects (id) on delete set null,
  report_type           public.report_type not null default 'citizen_concern',
  title                 text not null check (char_length(title) between 3 and 300),
  body                  text not null check (char_length(body) between 1 and 10000),
  status                public.report_status not null default 'submitted',
  is_public             boolean not null default false,
  -- A handler explicitly shares a private concern with the contractor
  -- assigned to its project. Reset whenever the project changes.
  shared_with_contractor boolean not null default false,
  barangay              text,
  latitude              double precision,
  longitude             double precision,
  reported_progress     smallint check (reported_progress between 0 and 100),
  submitted_by          uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  handled_by            uuid references public.profiles (id) on delete set null,
  resolution_notes      text,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint reports_valid_coordinates_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  -- Progress and inspection reports must be about a project.
  constraint reports_project_required_check check (
    report_type = 'citizen_concern' or project_id is not null
  )
);

create index reports_project_id_idx on public.reports (project_id);
create index reports_submitted_by_idx on public.reports (submitted_by);
create index reports_status_idx on public.reports (status);

-- -----------------------------------------------------------------------------
-- comments: discussion on exactly one of project / proposal / report
-- -----------------------------------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  proposal_id uuid references public.proposals (id) on delete cascade,
  report_id   uuid references public.reports (id) on delete cascade,
  -- restrict: discussion history outlives accounts (deactivate, don't delete).
  author_id   uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  body        text not null check (char_length(body) between 1 and 5000),
  visibility  public.comment_visibility not null default 'public',
  is_hidden   boolean not null default false, -- set by staff moderation
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint comments_one_parent_check
    check (num_nonnulls(project_id, proposal_id, report_id) = 1)
);

create index comments_project_id_idx on public.comments (project_id, created_at);
create index comments_proposal_id_idx on public.comments (proposal_id, created_at);
create index comments_report_id_idx on public.comments (report_id, created_at);
create index comments_author_id_idx on public.comments (author_id);

-- -----------------------------------------------------------------------------
-- project_status_history: append-only, written ONLY by trigger
-- -----------------------------------------------------------------------------
create table public.project_status_history (
  id          bigint generated always as identity primary key,
  project_id  uuid not null references public.projects (id) on delete cascade,
  from_status public.project_status,
  to_status   public.project_status not null,
  from_stage  public.lifecycle_stage,
  to_stage    public.lifecycle_stage not null,
  note        text,
  changed_by  uuid references public.profiles (id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index project_status_history_project_idx on public.project_status_history (project_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- attachments: metadata for files kept in Supabase Storage (exactly one parent)
-- Storage bucket + storage.objects policies come in a later migration; see
-- supabase/SECURITY_NOTES.md. mime_type and size_bytes are client-declared:
-- the bucket's own limits must enforce the same values.
-- -----------------------------------------------------------------------------
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects (id) on delete cascade,
  proposal_id  uuid references public.proposals (id) on delete cascade,
  report_id    uuid references public.reports (id) on delete cascade,
  purpose      public.attachment_purpose not null,
  storage_path text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 255),
  mime_type    text not null check (mime_type in (
                 'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  size_bytes   bigint not null check (size_bytes between 1 and 26214400), -- 25 MiB
  is_public    boolean not null default false,
  uploaded_by  uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),

  constraint attachments_one_parent_check
    check (num_nonnulls(project_id, proposal_id, report_id) = 1),

  -- Each purpose belongs to exactly one parent kind.
  constraint attachments_purpose_parent_check check (
    case purpose
      when 'proposal_document'    then proposal_id is not null
      when 'decision_document'    then proposal_id is not null
      when 'budget_document'      then project_id is not null
      when 'procurement_document' then project_id is not null
      when 'monitoring_evidence'  then project_id is not null
      when 'inspection_evidence'  then report_id is not null
      when 'progress_evidence'    then report_id is not null
      when 'concern_evidence'     then report_id is not null
      else false
    end
  ),

  -- {projects|proposals|reports}/{parent id}/{uploader id}/{uuid}-{safe name}
  -- The path must name this row's own parent and uploader, so nobody can
  -- claim (or squat) a path in another record's or another user's folder.
  constraint attachments_storage_path_check check (
    storage_path ~ '^(projects|proposals|reports)/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$'
    and split_part(storage_path, '/', 1) = case
          when project_id is not null then 'projects'
          when proposal_id is not null then 'proposals'
          else 'reports'
        end
    and split_part(storage_path, '/', 2) = coalesce(project_id, proposal_id, report_id)::text
    and split_part(storage_path, '/', 3) = uploaded_by::text
  )
);

create index attachments_project_id_idx on public.attachments (project_id);
create index attachments_proposal_id_idx on public.attachments (proposal_id);
create index attachments_report_id_idx on public.attachments (report_id);

-- -----------------------------------------------------------------------------
-- audit_log: append-only, written ONLY by trigger, readable by admins
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  uuid,
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id   uuid,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_record_idx on public.audit_log (table_name, record_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger organization_contacts_set_updated_at before update on public.organization_contacts
  for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger proposals_set_updated_at before update on public.proposals
  for each row execute function private.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function private.set_updated_at();
create trigger project_milestones_set_updated_at before update on public.project_milestones
  for each row execute function private.set_updated_at();
create trigger reports_set_updated_at before update on public.reports
  for each row execute function private.set_updated_at();
create trigger comments_set_updated_at before update on public.comments
  for each row execute function private.set_updated_at();
