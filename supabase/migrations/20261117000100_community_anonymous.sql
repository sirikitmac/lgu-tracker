-- =============================================================================
-- LGU Tracker · Migration · Anonymous posts and comments in Bantay Community
-- =============================================================================
-- A signed-in person can post or comment anonymously. Everyone sees
-- "Anonymous" with no job title and no picture.
--
-- How the real author stays private:
--   * An anonymous row in community_posts / community_comments stores NO
--     author at all: author_id is null and the shown name is "Anonymous". So
--     the public tables, their Realtime events and any count or filter on them
--     cannot reveal who wrote it.
--   * Who wrote it is kept in public.community_anonymous_authors, written only
--     by a trigger (clients have no write access) and readable only by that
--     author (to know which items are theirs) and by administrators
--     (lgu_admin, super_admin). It is not published to Realtime.
--   * The guard still checks the active profile and the rate limit (anonymous
--     items count too), and still refuses an author that is not the caller.
--   * Deleting your own: allowed when the private record says it is yours.
--   * Profile edits never touch anonymous rows (their author_id is null); the
--     private record's name is kept current for administrators.
--   * When an account is deleted, its anonymous items go with it, as before.
--
-- Existing posts and comments stay as they are (is_anonymous = false).
-- =============================================================================

alter table public.community_posts add column is_anonymous boolean not null default false;
alter table public.community_comments add column is_anonymous boolean not null default false;

alter table public.community_posts drop constraint community_posts_has_author;
alter table public.community_posts add constraint community_posts_has_author
  check (author_id is not null or (is_sample and sample_author is not null) or is_anonymous);
alter table public.community_posts add constraint community_posts_anonymous_shape
  check (not is_anonymous or (author_id is null and sample_author is null and not is_sample
         and author_title is null and author_avatar_path is null and author_avatar_preset is null));

alter table public.community_comments drop constraint community_comments_has_author;
alter table public.community_comments add constraint community_comments_has_author
  check (author_id is not null or (is_sample and sample_author is not null) or is_anonymous);
alter table public.community_comments add constraint community_comments_anonymous_shape
  check (not is_anonymous or (author_id is null and sample_author is null and not is_sample
         and author_title is null and author_avatar_path is null and author_avatar_preset is null));

-- -----------------------------------------------------------------------------
-- The private record of who wrote an anonymous item.
-- -----------------------------------------------------------------------------
create table public.community_anonymous_authors (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid unique references public.community_posts (id) on delete cascade,
  comment_id  uuid unique references public.community_comments (id) on delete cascade,
  author_id   uuid not null references auth.users (id) on delete cascade,
  -- For administrators: the author's current name (kept up to date below).
  author_name text not null default 'Community member' check (char_length(btrim(author_name)) between 1 and 80),
  created_at  timestamptz not null default now(),
  constraint community_anonymous_authors_one_target check (num_nonnulls(post_id, comment_id) = 1)
);

create index community_anonymous_authors_author_idx on public.community_anonymous_authors (author_id, created_at desc);

alter table public.community_anonymous_authors enable row level security;
revoke all on public.community_anonymous_authors from public, anon, authenticated;
grant select on public.community_anonymous_authors to authenticated;
grant select, insert, update, delete on public.community_anonymous_authors to service_role;

create policy "community anonymous authors: you see your own" on public.community_anonymous_authors
  for select to authenticated using (author_id = (select auth.uid()));
create policy "community anonymous authors: admins see all" on public.community_anonymous_authors
  for select to authenticated using ((select private.is_admin()));

-- Whether the caller wrote this anonymous post or comment. Security definer so
-- the delete policies below do not depend on the caller's view of the table;
-- it only ever answers for the caller.
create or replace function private.is_my_anonymous_community_item(p_post uuid, p_comment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_anonymous_authors a
     where a.author_id = (select auth.uid())
       and ((p_post is not null and a.post_id = p_post) or (p_comment is not null and a.comment_id = p_comment))
  );
$$;

revoke all on function private.is_my_anonymous_community_item(uuid, uuid) from public;
grant execute on function private.is_my_anonymous_community_item(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Guards (replace the ones from 20261112000100). Same rules, plus: an
-- anonymous item is written by the caller, stored without an author, and
-- shown as "Anonymous". Not security definer: they must see who is asking.
-- -----------------------------------------------------------------------------
create or replace function private.guard_community_post()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  p  record;
begin
  if not private.is_end_user_request() then
    return new;
  end if;
  if me is null
     or (not new.is_anonymous and new.author_id is distinct from me)
     or (new.is_anonymous and new.author_id is not null and new.author_id <> me) then
    raise exception 'Permission denied: you can only post as yourself' using errcode = '42501';
  end if;

  select pr.full_name, pr.position_title, pr.avatar_path, pr.avatar_preset
    into p from public.profiles pr where pr.id = me and pr.is_active;
  if not found then
    raise exception 'Permission denied: an active profile is needed to post' using errcode = '42501';
  end if;

  if (select count(*) from public.community_posts x where x.author_id = me and x.created_at > now() - interval '1 hour')
     + (select count(*) from public.community_anonymous_authors a
         where a.author_id = me and a.post_id is not null and a.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You are posting too fast. Please wait a little before starting another discussion.' using errcode = 'P0001';
  end if;

  new.sample_author := null;
  new.is_sample := false;
  new.base_score := 0;
  new.score := 0;
  new.comment_count := 0;
  new.created_at := now();
  new.title := btrim(new.title);
  new.body := btrim(new.body);
  if new.is_anonymous then
    new.author_id := null;
    new.author_name := 'Anonymous';
    new.author_title := null;
    new.author_avatar_path := null;
    new.author_avatar_preset := null;
  else
    new.author_name := left(coalesce(nullif(btrim(regexp_replace(p.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80);
    new.author_title := left(nullif(btrim(p.position_title), ''), 60);
    new.author_avatar_path := p.avatar_path;
    new.author_avatar_preset := p.avatar_preset;
  end if;
  return new;
end;
$$;

create or replace function private.guard_community_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  p      record;
  parent record;
begin
  if not private.is_end_user_request() then
    return new;
  end if;
  if me is null
     or (not new.is_anonymous and new.author_id is distinct from me)
     or (new.is_anonymous and new.author_id is not null and new.author_id <> me) then
    raise exception 'Permission denied: you can only comment as yourself' using errcode = '42501';
  end if;

  select pr.full_name, pr.position_title, pr.avatar_path, pr.avatar_preset
    into p from public.profiles pr where pr.id = me and pr.is_active;
  if not found then
    raise exception 'Permission denied: an active profile is needed to comment' using errcode = '42501';
  end if;

  if new.parent_id is not null then
    select c.post_id into parent from public.community_comments c where c.id = new.parent_id;
    if not found or parent.post_id is distinct from new.post_id then
      raise exception 'That reply does not belong to this discussion' using errcode = '23514';
    end if;
  end if;

  if (select count(*) from public.community_comments x where x.author_id = me and x.created_at > now() - interval '10 minutes')
     + (select count(*) from public.community_anonymous_authors a
         where a.author_id = me and a.comment_id is not null and a.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'You are commenting too fast. Please wait a moment.' using errcode = 'P0001';
  end if;

  new.sample_author := null;
  new.is_sample := false;
  new.base_score := 0;
  new.score := 0;
  new.created_at := now();
  new.body := btrim(new.body);
  if new.is_anonymous then
    new.author_id := null;
    new.author_name := 'Anonymous';
    new.author_title := null;
    new.author_avatar_path := null;
    new.author_avatar_preset := null;
  else
    new.author_name := left(coalesce(nullif(btrim(regexp_replace(p.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80);
    new.author_title := left(nullif(btrim(p.position_title), ''), 60);
    new.author_avatar_path := p.avatar_path;
    new.author_avatar_preset := p.avatar_preset;
  end if;
  return new;
end;
$$;

-- After an anonymous insert: record the real author privately. Security
-- definer, because clients cannot write that table. Only signed-in callers
-- can create anonymous items.
create or replace function private.record_community_anonymous_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v_name text;
begin
  if not new.is_anonymous then
    return null;
  end if;
  if me is null then
    raise exception 'An anonymous post or comment needs a signed-in author' using errcode = '42501';
  end if;
  select left(coalesce(nullif(btrim(regexp_replace(pr.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80)
    into v_name from public.profiles pr where pr.id = me;
  if tg_table_name = 'community_posts' then
    insert into public.community_anonymous_authors (post_id, author_id, author_name, created_at)
    values (new.id, me, coalesce(v_name, 'Community member'), new.created_at);
  else
    insert into public.community_anonymous_authors (comment_id, author_id, author_name, created_at)
    values (new.id, me, coalesce(v_name, 'Community member'), new.created_at);
  end if;
  return null;
end;
$$;

create trigger community_posts_record_anonymous after insert on public.community_posts
  for each row when (new.is_anonymous) execute function private.record_community_anonymous_author();
create trigger community_comments_record_anonymous after insert on public.community_comments
  for each row when (new.is_anonymous) execute function private.record_community_anonymous_author();

-- An account deleted: its private records go (cascade), and so do the
-- anonymous items they point at, like the account's named items.
create or replace function private.drop_orphaned_anonymous_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.post_id is not null then
    delete from public.community_posts where id = old.post_id and is_anonymous;
  else
    delete from public.community_comments where id = old.comment_id and is_anonymous;
  end if;
  return null;
end;
$$;

create trigger community_anonymous_authors_cleanup after delete on public.community_anonymous_authors
  for each row execute function private.drop_orphaned_anonymous_item();

-- Profile edits refresh named items only; anonymous items keep showing
-- "Anonymous". Administrators' copy of the name follows the profile.
create or replace function private.refresh_community_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(coalesce(nullif(btrim(regexp_replace(new.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80);
  v_title text := left(nullif(btrim(new.position_title), ''), 60);
begin
  if (new.full_name, new.position_title, new.avatar_path, new.avatar_preset)
     is not distinct from (old.full_name, old.position_title, old.avatar_path, old.avatar_preset) then
    return null;
  end if;
  update public.community_posts
     set author_name = v_name, author_title = v_title,
         author_avatar_path = new.avatar_path, author_avatar_preset = new.avatar_preset
   where author_id = new.id and not is_anonymous;
  update public.community_comments
     set author_name = v_name, author_title = v_title,
         author_avatar_path = new.avatar_path, author_avatar_preset = new.avatar_preset
   where author_id = new.id and not is_anonymous;
  if new.full_name is distinct from old.full_name then
    update public.community_anonymous_authors set author_name = v_name where author_id = new.id;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges and policies
-- -----------------------------------------------------------------------------
grant insert (is_anonymous) on public.community_posts to authenticated;
grant insert (is_anonymous) on public.community_comments to authenticated;

drop policy "community posts: write as yourself" on public.community_posts;
create policy "community posts: write as yourself" on public.community_posts for insert to authenticated
  with check (author_id = (select auth.uid()) or (is_anonymous and author_id is null and (select auth.uid()) is not null));

drop policy "community posts: delete your own" on public.community_posts;
create policy "community posts: delete your own" on public.community_posts for delete to authenticated
  using (author_id = (select auth.uid()) or (is_anonymous and private.is_my_anonymous_community_item(id, null)));

drop policy "community comments: write as yourself" on public.community_comments;
create policy "community comments: write as yourself" on public.community_comments for insert to authenticated
  with check (author_id = (select auth.uid()) or (is_anonymous and author_id is null and (select auth.uid()) is not null));

drop policy "community comments: delete your own" on public.community_comments;
create policy "community comments: delete your own" on public.community_comments for delete to authenticated
  using (author_id = (select auth.uid()) or (is_anonymous and private.is_my_anonymous_community_item(null, id)));
