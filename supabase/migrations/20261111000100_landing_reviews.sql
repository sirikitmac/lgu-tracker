-- =============================================================================
-- LGU Tracker · Migration · Reviews on the landing page
-- =============================================================================
-- Anyone signed in can leave ONE review of Bantay Proyekto: a 1 to 5 star
-- rating and a short text. Reviews are shown on the public landing page and
-- update live (Supabase Realtime).
--
-- Profiles are not publicly readable, so a review carries a copy of how its
-- author appears (name, job title, picture), taken from their profile when the
-- review is saved. The guard trigger below fills that copy in from the profile
-- itself, so nobody can post under a name or picture that is not theirs. The
-- only choice left to the author is "first name only".
--
-- Rules:
--   * Everyone (signed in or not) sees published reviews only. The author also
--     sees their own review, and administrators see all, so they can hide or
--     show one again.
--   * A signed-in person adds, edits and deletes their own review only. They
--     cannot change its status.
--   * Administrators (lgu_admin, super_admin) can hide or show any review,
--     and delete one. They cannot rewrite what someone else wrote.
-- =============================================================================

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  body          text not null check (char_length(btrim(body)) between 10 and 500),
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 80),
  job_title     text check (job_title is null or char_length(job_title) <= 60),
  avatar_path   text,
  avatar_preset text,
  status        text not null default 'published' check (status in ('published', 'hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- The same picture checks as public.profiles: a photo must sit in the
  -- author's own folder of the avatars bucket; a free avatar has a safe id.
  constraint reviews_avatar_path_shape
    check (avatar_path is null
           or avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'),
  constraint reviews_avatar_path_own_folder
    check (avatar_path is null or split_part(avatar_path, '/', 1) = user_id::text),
  constraint reviews_avatar_preset_shape
    check (avatar_preset is null or avatar_preset ~ '^[a-z][a-z0-9-]{0,23}$'),
  constraint reviews_avatar_one_source
    check (avatar_path is null or avatar_preset is null)
);

-- The landing page lists the newest published reviews.
create index reviews_published_idx on public.reviews (created_at desc) where status = 'published';

create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Guard: status is for administrators only, nobody rewrites someone else's
-- review, and the author's name, job and picture always come from their own
-- profile. Migrations, the SQL editor and the service role are not limited.
-- Runs as the caller (not security definer), so it can tell who is asking;
-- the author can always read their own profile row.
-- -----------------------------------------------------------------------------
create or replace function private.guard_review_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me        uuid := (select auth.uid());
  v_admin   boolean := private.is_admin();
  changed   text[];
  p         record;
  v_name    text;
  v_first   text;
begin
  if not private.is_end_user_request() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    changed := array_remove(private.changed_columns(to_jsonb(old), to_jsonb(new)), 'updated_at');

    if 'status' = any (changed) and not v_admin then
      raise exception 'Permission denied: only an administrator can hide or show a review'
        using errcode = '42501';
    end if;

    if old.user_id is distinct from me then
      -- Someone else's review: an administrator may change its status, nothing else.
      perform private.assert_columns_allowed(changed, array['status'], 'administrator');
      return new;
    end if;

    perform private.assert_columns_allowed(
      changed,
      array['rating', 'body', 'display_name', 'job_title', 'avatar_path', 'avatar_preset', 'status'],
      'review author'
    );
  elsif new.user_id is distinct from me then
    raise exception 'Permission denied: you can only write your own review' using errcode = '42501';
  end if;

  -- The author's own row: copy how they appear from their profile.
  select pr.full_name, pr.position_title, pr.avatar_path, pr.avatar_preset
    into p
    from public.profiles pr
   where pr.id = new.user_id and pr.is_active;
  if not found then
    raise exception 'Permission denied: an active profile is needed to write a review' using errcode = '42501';
  end if;

  v_name := coalesce(nullif(btrim(regexp_replace(p.full_name, '\s+', ' ', 'g')), ''), 'Community member');
  v_first := split_part(v_name, ' ', 1);
  new.display_name := case when btrim(new.display_name) = v_first then v_first else v_name end;
  new.display_name := left(new.display_name, 80);
  new.job_title := left(nullif(btrim(p.position_title), ''), 60);
  new.avatar_path := p.avatar_path;
  new.avatar_preset := p.avatar_preset;
  new.body := btrim(new.body);
  return new;
end;
$$;

create trigger reviews_guard_write before insert or update on public.reviews
  for each row execute function private.guard_review_write();

-- -----------------------------------------------------------------------------
-- Privileges and row-level security
-- -----------------------------------------------------------------------------
alter table public.reviews enable row level security;

-- Defined explicitly: Supabase's default privileges would otherwise hand
-- anon/authenticated full access to a new table.
revoke all on public.reviews from public, anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (user_id, rating, body, display_name, job_title, avatar_path, avatar_preset, status)
  on public.reviews to authenticated;
grant update (rating, body, display_name, job_title, avatar_path, avatar_preset, status)
  on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
grant select, insert, update, delete on public.reviews to service_role;

create policy "reviews: anyone reads published"
  on public.reviews for select
  to anon, authenticated
  using (status = 'published');

-- So an author can still find (and edit or delete) a review that was hidden,
-- and administrators can show a hidden review again.
create policy "reviews: authors see their own, admins see all"
  on public.reviews for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "reviews: write your own"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()) and status = 'published');

create policy "reviews: edit your own"
  on public.reviews for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "reviews: admins moderate"
  on public.reviews for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "reviews: delete your own"
  on public.reviews for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "reviews: admins delete"
  on public.reviews for delete
  to authenticated
  using ((select private.is_admin()));

-- Live updates on the landing page (postgres_changes honours the policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.reviews;
  end if;
end $$;
