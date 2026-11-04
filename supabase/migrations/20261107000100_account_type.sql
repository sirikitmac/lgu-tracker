-- =============================================================================
-- LGU Tracker · Migration · Account type chosen at sign-up
-- =============================================================================
-- Sign-up now asks "who are you?" with three choices. This is a CATEGORY the
-- person declares about themselves. It never grants access:
--
--   * Authorization still comes only from public.profiles.role (app_role),
--     which only an administrator can change (private.guard_profile_update).
--   * account_type and claimed_organization come from Auth user metadata, which
--     is client-supplied and therefore untrusted. They exist so an
--     administrator can see who says they work where, and decide what role (if
--     any) to grant. Nothing in RLS reads them.
--   * Only an administrator can change them afterwards (not in the
--     profile-owner whitelist below).
--
-- Every account, whatever it declares, starts with role = 'citizen'. Any
-- signed-in, active account may file a report on a project (see the reports
-- migration); the account type does not change that.
-- =============================================================================

create type public.account_type as enum (
  'organization_employee',  -- works for an LGU office, agency, or contractor
  'technical_developer',    -- builds or maintains the system / its data
  'citizen'                 -- member of the public (default)
);

alter table public.profiles
  add column account_type public.account_type not null default 'citizen',
  add column claimed_organization text
    check (char_length(claimed_organization) <= 200);

comment on column public.profiles.account_type is
  'What the user said they are at sign-up (self-reported via Auth user metadata). '
  'Informational only: never grants access. Authorization is profiles.role.';
comment on column public.profiles.claimed_organization is
  'Organization an organization_employee said they work for (self-reported, '
  'unverified). Informational, for administrator review. Compare organization_id, '
  'which an administrator sets after verifying.';

-- -----------------------------------------------------------------------------
-- Sign-up trigger: record the declared type. role is untouched (stays citizen).
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested public.app_role;
  chosen    public.account_type;
  org       text;
begin
  begin
    requested := (new.raw_user_meta_data ->> 'requested_role')::public.app_role;
  exception when invalid_text_representation then
    requested := null;
  end;
  if requested = 'citizen' then
    requested := null;
  end if;

  begin
    chosen := coalesce((new.raw_user_meta_data ->> 'account_type')::public.account_type, 'citizen');
  exception when invalid_text_representation then
    chosen := 'citizen';
  end;

  -- Only organization employees have an organization to name.
  org := nullif(btrim(left(coalesce(new.raw_user_meta_data ->> 'claimed_organization', ''), 200)), '');
  if chosen <> 'organization_employee' then
    org := null;
  end if;

  insert into public.profiles (id, full_name, requested_role, account_type, claimed_organization)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200),
    requested,
    chosen,
    org
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profile guard: same rules as before, plus administrators may correct the two
-- new columns. Everyone else still cannot touch them.
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
            'can_decide_proposals', 'requested_role', 'account_type', 'claimed_organization'],
      'administrator'
    );

    if new.id = (select auth.uid())
       and (new.role is distinct from old.role
            or new.is_active is distinct from old.is_active
            or new.can_decide_proposals is distinct from old.can_decide_proposals) then
      raise exception 'Permission denied: administrators cannot change their own role, active status, or decision authority'
        using errcode = '42501';
    end if;

    if actor_role <> 'super_admin'
       and (old.role in ('super_admin', 'lgu_admin') or new.role in ('super_admin', 'lgu_admin'))
       and new.id <> (select auth.uid()) then
      raise exception 'Permission denied: only a super_admin can manage administrator accounts'
        using errcode = '42501';
    end if;

    return new;
  end if;

  -- Everyone else: self-service fields only. account_type, claimed_organization
  -- and requested_role are deliberately excluded.
  perform private.assert_columns_allowed(
    changed,
    array['full_name', 'position_title', 'barangay'],
    'profile owner'
  );
  return new;
end;
$$;
