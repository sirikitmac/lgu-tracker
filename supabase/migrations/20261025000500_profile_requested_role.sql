-- =============================================================================
-- LGU Tracker · Migration 5 · Self-reported role request at sign-up
-- =============================================================================
-- The public Sign Up page lets a visitor pick the role they are asking for
-- (Planner, Budget Officer, LGU Administrator, etc.). That choice must never
-- grant access by itself, so it is never written to public.profiles.role —
-- role keeps defaulting to 'citizen' and can only be changed by an
-- administrator (private.guard_profile_update, migration 3).
--
-- This migration adds a column to remember what was requested, purely for an
-- administrator to review and act on. It is populated once, by the existing
-- sign-up trigger, from Supabase Auth user metadata (client-supplied, already
-- untrusted for authorization everywhere else in this schema) and is
-- otherwise inert: no authorization helper reads it.
-- =============================================================================

alter table public.profiles
  add column requested_role public.app_role;

comment on column public.profiles.requested_role is
  'Role the user asked for at sign-up (self-reported, via Auth user metadata). '
  'Informational only — never grants access. role stays citizen until an '
  'administrator reviews the request and changes role explicitly.';

-- -----------------------------------------------------------------------------
-- Capture the request at insert time. role is untouched: still always
-- 'citizen' (the column default from migration 2).
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested public.app_role;
begin
  begin
    requested := (new.raw_user_meta_data ->> 'requested_role')::public.app_role;
  exception when invalid_text_representation then
    requested := null;
  end;

  -- citizen is the default role already; recording it as "requested" would
  -- just be noise for the administrator reviewing pending requests.
  if requested = 'citizen' then
    requested := null;
  end if;

  insert into public.profiles (id, full_name, requested_role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200),
    requested
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Let an administrator clear/update the request as part of reviewing it
-- (e.g. once they grant role, or if they dismiss it). Everyone else keeps no
-- access to this column (not in the profile-owner whitelist).
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
            'can_decide_proposals', 'requested_role'],
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
  -- own row). requested_role is deliberately excluded: it is set once by the
  -- sign-up trigger and from then on only an administrator may touch it.
  perform private.assert_columns_allowed(
    changed,
    array['full_name', 'position_title', 'barangay'],
    'profile owner'
  );
  return new;
end;
$$;
