-- =============================================================================
-- LGU Tracker · Migration · Profile picture, free avatars and job title
-- =============================================================================
-- Anyone signed in can now edit how they appear:
--
--   * their name              (profiles.full_name, already there)
--   * a job title like "Teacher" or "Engineer"
--                             (profiles.position_title, already there; a label
--                              only, it never changes what the person can do)
--   * a picture: either a photo they upload (profiles.avatar_path, a file in
--     the 'avatars' bucket) or one of the free drawn avatars
--     (profiles.avatar_preset, an id such as 'p3'). One or the other, never both.
--
-- What this adds:
--   1. The two profile columns, with checks. A photo path must point into the
--      person's own folder, so nobody can show someone else's file as theirs.
--   2. The profile guard now lets the owner (and administrators) change those
--      two columns. Role, account type and the rest stay locked as before.
--   3. A public 'avatars' bucket: a profile picture is meant to be seen, so the
--      files are readable by link, but only the owner can add, replace or remove
--      files in their own folder: {account id}/{uuid}.jpg, images up to 1 MB.
--
-- The browser crops and re-encodes the photo to a small square before upload,
-- which also removes the location and device details stored inside a photo.
-- =============================================================================

alter table public.profiles
  add column if not exists avatar_path   text,
  add column if not exists avatar_preset text;

alter table public.profiles
  add constraint profiles_avatar_path_shape
    check (avatar_path is null
           or avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'),
  add constraint profiles_avatar_path_own_folder
    check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text),
  add constraint profiles_avatar_preset_shape
    check (avatar_preset is null or avatar_preset ~ '^[a-z][a-z0-9-]{0,23}$'),
  add constraint profiles_avatar_one_source
    check (avatar_path is null or avatar_preset is null);

-- -----------------------------------------------------------------------------
-- The profile guard: same rules as before, plus the two picture columns.
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
            'can_decide_proposals', 'requested_role', 'account_type', 'claimed_organization',
            'avatar_path', 'avatar_preset'],
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
    array['full_name', 'position_title', 'barangay', 'avatar_path', 'avatar_preset'],
    'profile owner'
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage: the public bucket and its policies. Skipped where Supabase Storage
-- does not exist (plain Postgres in tests that do not model it).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/webp'])
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Everyone can see a profile picture. (Needed by the owner too: removing a
  -- file needs the row to be visible.)
  execute $p$
    create policy "avatars: anyone can read"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'avatars')
  $p$;

  -- Add a picture to your own folder only: {your account id}/{uuid}.jpg
  execute $p$
    create policy "avatars: add to your own folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'
        and split_part(name, '/', 1) = (select auth.uid())::text
      )
  $p$;

  -- Remove your own old pictures.
  execute $p$
    create policy "avatars: remove your own"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'avatars'
        and split_part(name, '/', 1) = (select auth.uid())::text
      )
  $p$;
end $$;
