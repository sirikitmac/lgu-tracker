-- =============================================================================
-- LGU Tracker · Migration 1 · Schemas, enumerated types, and generic helpers
-- =============================================================================
-- The `private` schema holds helper and trigger functions. It is NOT exposed
-- through the Supabase Data API (only `public` is), so nothing in it can be
-- called as an RPC. Policies and guard triggers still need USAGE/EXECUTE on
-- the helpers, which migration 4 grants explicitly to anon, authenticated, and
-- service_role.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------

-- The nine platform roles. Stored on public.profiles.role and ONLY changeable
-- by administrators (enforced by trigger in migration 3).
create type public.app_role as enum (
  'super_admin',       -- Municipal IT administrator; full control
  'lgu_admin',         -- LGU system administrator; manages users and data
  'planning_officer',  -- City Planning & Development Office (CPDO)
  'budget_officer',    -- Budget / Accounting office; manages budget figures
  'bac_member',        -- Bids and Awards Committee; procurement details
  'project_engineer',  -- City Engineer's Office / sector project officer
  'council_member',    -- Sangguniang Panlungsod; read-only oversight
  'contractor',        -- Contractor or implementing partner staff
  'citizen'            -- Registered member of the public (default)
);

-- Mirrors ProjectCategory in src/types/project.ts (mapped in projectMapper.ts).
create type public.project_category as enum (
  'infrastructure_public_works',
  'education_youth_development',
  'disaster_risk_reduction',
  'health_sanitation'
);

-- Mirrors ProjectStatus in src/types/project.ts.
create type public.project_status as enum (
  'planned',
  'procurement',
  'in_progress',
  'delayed',
  'completed'
);

-- Mirrors LifecycleStageId in src/types/project.ts.
create type public.lifecycle_stage as enum (
  'planning',
  'procurement',
  'implementation',
  'completion'
);

-- Only 'published' projects are visible to the public.
create type public.project_visibility as enum ('draft', 'published', 'archived');

create type public.organization_type as enum (
  'lgu_office',
  'contractor',
  'barangay',
  'partner',
  'council'
);

create type public.assignment_role as enum (
  'implementing_office',
  'contractor',
  'engineer',
  'inspector',
  'monitor'
);

create type public.proposal_status as enum (
  'draft',
  'submitted',
  'under_review',
  'returned',
  'approved',
  'rejected'
);

create type public.report_type as enum (
  'citizen_concern',
  'progress_report',
  'inspection_report'
);

create type public.report_status as enum (
  'submitted',
  'acknowledged',
  'in_review',
  'resolved',
  'dismissed'
);

create type public.comment_visibility as enum ('public', 'internal');

-- A formal Development Council (or administrator override) decision.
create type public.proposal_decision_type as enum ('approved', 'rejected');

-- Why a file was uploaded. Each purpose is tied to one parent kind and one
-- set of roles (private.can_upload_attachment in migration 3).
create type public.attachment_purpose as enum (
  'proposal_document',     -- planner, on their own proposal
  'decision_document',     -- authorized council member, supporting a decision
  'budget_document',       -- budget officer, on a project
  'procurement_document',  -- BAC member, on a project
  'inspection_evidence',   -- engineer/inspector, on an inspection report
  'progress_evidence',     -- contractor/assignee, on a progress report
  'monitoring_evidence',   -- assigned monitor, on a project
  'concern_evidence'       -- citizen, on their own unhandled concern
);

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------

-- Keeps updated_at current on every UPDATE.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Lists the columns whose values differ between two row images. Guard
-- triggers use it to whitelist the columns each role may change.
create or replace function private.changed_columns(old_row jsonb, new_row jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(n.key order by n.key), '{}')
  from jsonb_each(new_row) as n
  where n.value is distinct from (old_row -> n.key);
$$;

-- True when the current statement comes from the Data API on behalf of an
-- end user (anon or authenticated). Migrations, the SQL editor, and the
-- service role skip the per-role column guards, which lets the first
-- super_admin be bootstrapped.
create or replace function private.is_end_user_request()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;
