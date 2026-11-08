-- =============================================================================
-- LGU Tracker · Migration · Bantay Community on the database
-- =============================================================================
-- Discussions, comments (with replies) and up/down votes, shared by everyone
-- and updated live (Supabase Realtime).
--
-- Profiles are not publicly readable, so a post or comment carries a copy of
-- how its author appears (name, job title, picture). A guard trigger fills the
-- copy in from the author's own profile, so nobody can post under a name or a
-- picture that is not theirs, and a second trigger refreshes the copies when
-- the person edits their profile.
--
-- Rules:
--   * Everyone, signed in or not, reads all discussions and comments.
--   * A signed-in person writes posts and comments as themselves only, and
--     deletes their own. Administrators (lgu_admin, super_admin) can delete
--     any post or comment. Nobody edits what was posted.
--   * Scores and comment counts are kept by triggers; clients cannot set them.
--   * A person sees and changes only their own votes. One vote per person per
--     post or comment: +1 or -1; removing it deletes the row.
--   * Light rate limit: 10 posts an hour, 30 comments every 10 minutes.
--
-- The sample discussions of the preview are stored too (is_sample = true, no
-- real author), so voting and replying work on them like on any other. They
-- are added by the next migration.
-- =============================================================================

create table public.community_posts (
  id                   uuid primary key default gen_random_uuid(),
  author_id            uuid references auth.users (id) on delete cascade,
  -- Sample posts have no account; this is the key of the made-up person.
  sample_author        text check (sample_author is null or sample_author ~ '^[a-z][a-z0-9-]{0,31}$'),
  title                text not null check (char_length(btrim(title)) between 8 and 140),
  body                 text not null check (char_length(btrim(body)) between 10 and 2000),
  -- The project the discussion is about (optional). The link stays on this site.
  project_title        text check (project_title is null or char_length(project_title) <= 200),
  project_code         text check (project_code is null or char_length(project_code) <= 60),
  project_href         text check (project_href is null or (char_length(project_href) <= 300 and project_href ~ '^/[A-Za-z0-9/_?=&%.#:+~,-]*$')),
  author_name          text not null default 'Community member' check (char_length(btrim(author_name)) between 1 and 80),
  author_title         text check (author_title is null or char_length(author_title) <= 60),
  author_avatar_path   text,
  author_avatar_preset text,
  base_score           integer not null default 0,
  score                integer not null default 0,
  comment_count        integer not null default 0,
  is_sample            boolean not null default false,
  created_at           timestamptz not null default now(),

  constraint community_posts_has_author check (author_id is not null or (is_sample and sample_author is not null)),
  constraint community_posts_avatar_path_shape
    check (author_avatar_path is null
           or author_avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'),
  constraint community_posts_avatar_preset_shape
    check (author_avatar_preset is null or author_avatar_preset ~ '^[a-z][a-z0-9-]{0,23}$')
);

create table public.community_comments (
  id                   uuid primary key default gen_random_uuid(),
  post_id              uuid not null references public.community_posts (id) on delete cascade,
  -- null: a comment on the post itself; otherwise the comment being replied to.
  parent_id            uuid references public.community_comments (id) on delete cascade,
  author_id            uuid references auth.users (id) on delete cascade,
  sample_author        text check (sample_author is null or sample_author ~ '^[a-z][a-z0-9-]{0,31}$'),
  body                 text not null check (char_length(btrim(body)) between 1 and 1000),
  author_name          text not null default 'Community member' check (char_length(btrim(author_name)) between 1 and 80),
  author_title         text check (author_title is null or char_length(author_title) <= 60),
  author_avatar_path   text,
  author_avatar_preset text,
  base_score           integer not null default 0,
  score                integer not null default 0,
  is_sample            boolean not null default false,
  created_at           timestamptz not null default now(),

  constraint community_comments_has_author check (author_id is not null or (is_sample and sample_author is not null)),
  constraint community_comments_avatar_path_shape
    check (author_avatar_path is null
           or author_avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'),
  constraint community_comments_avatar_preset_shape
    check (author_avatar_preset is null or author_avatar_preset ~ '^[a-z][a-z0-9-]{0,23}$')
);

create table public.community_votes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  post_id    uuid references public.community_posts (id) on delete cascade,
  comment_id uuid references public.community_comments (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  constraint community_votes_one_target check (num_nonnulls(post_id, comment_id) = 1)
);

create unique index community_votes_post_once on public.community_votes (user_id, post_id) where post_id is not null;
create unique index community_votes_comment_once on public.community_votes (user_id, comment_id) where comment_id is not null;
create index community_votes_post_idx on public.community_votes (post_id) where post_id is not null;
create index community_votes_comment_idx on public.community_votes (comment_id) where comment_id is not null;
create index community_posts_created_idx on public.community_posts (created_at desc);
create index community_posts_author_idx on public.community_posts (author_id, created_at desc);
create index community_comments_post_idx on public.community_comments (post_id, created_at);
create index community_comments_author_idx on public.community_comments (author_id, created_at desc);
create index community_comments_parent_idx on public.community_comments (parent_id) where parent_id is not null;

-- -----------------------------------------------------------------------------
-- Guards: authors are always the signed-in person, the "how they appear" copy
-- comes from their profile, counts start at zero, and writing is rate limited.
-- Run as the caller (not security definer) so they can tell who is asking.
-- Migrations, the SQL editor, the service role and the triggers below are not limited.
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
  if new.author_id is distinct from me or me is null then
    raise exception 'Permission denied: you can only post as yourself' using errcode = '42501';
  end if;

  select pr.full_name, pr.position_title, pr.avatar_path, pr.avatar_preset
    into p from public.profiles pr where pr.id = me and pr.is_active;
  if not found then
    raise exception 'Permission denied: an active profile is needed to post' using errcode = '42501';
  end if;

  if (select count(*) from public.community_posts x where x.author_id = me and x.created_at > now() - interval '1 hour') >= 10 then
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
  new.author_name := left(coalesce(nullif(btrim(regexp_replace(p.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80);
  new.author_title := left(nullif(btrim(p.position_title), ''), 60);
  new.author_avatar_path := p.avatar_path;
  new.author_avatar_preset := p.avatar_preset;
  return new;
end;
$$;

create trigger community_posts_guard before insert on public.community_posts
  for each row execute function private.guard_community_post();

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
  if new.author_id is distinct from me or me is null then
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

  if (select count(*) from public.community_comments x where x.author_id = me and x.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'You are commenting too fast. Please wait a moment.' using errcode = 'P0001';
  end if;

  new.sample_author := null;
  new.is_sample := false;
  new.base_score := 0;
  new.score := 0;
  new.created_at := now();
  new.body := btrim(new.body);
  new.author_name := left(coalesce(nullif(btrim(regexp_replace(p.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80);
  new.author_title := left(nullif(btrim(p.position_title), ''), 60);
  new.author_avatar_path := p.avatar_path;
  new.author_avatar_preset := p.avatar_preset;
  return new;
end;
$$;

create trigger community_comments_guard before insert on public.community_comments
  for each row execute function private.guard_community_comment();

-- A vote must be the caller's own.
create or replace function private.guard_community_vote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_end_user_request() then
    return new;
  end if;
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'Permission denied: you can only vote as yourself' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.user_id, new.post_id, new.comment_id) is distinct from (old.user_id, old.post_id, old.comment_id) then
    raise exception 'A vote can only change its direction' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger community_votes_guard before insert or update on public.community_votes
  for each row execute function private.guard_community_vote();

-- -----------------------------------------------------------------------------
-- Counts: score = the sample's starting votes + the sum of real votes;
-- comment_count = comments on the post. Security definer, so a person who
-- votes or comments does not need (and does not get) write access to the totals.
-- -----------------------------------------------------------------------------
create or replace function private.refresh_community_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post    uuid := coalesce(new.post_id, old.post_id);
  v_comment uuid := coalesce(new.comment_id, old.comment_id);
begin
  if v_post is not null then
    update public.community_posts p
       set score = p.base_score + coalesce((select sum(v.value) from public.community_votes v where v.post_id = v_post), 0)
     where p.id = v_post;
  end if;
  if v_comment is not null then
    update public.community_comments c
       set score = c.base_score + coalesce((select sum(v.value) from public.community_votes v where v.comment_id = v_comment), 0)
     where c.id = v_comment;
  end if;
  return null;
end;
$$;

create trigger community_votes_refresh after insert or update or delete on public.community_votes
  for each row execute function private.refresh_community_score();

create or replace function private.refresh_community_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
begin
  update public.community_posts p
     set comment_count = (select count(*) from public.community_comments c where c.post_id = v_post)
   where p.id = v_post;
  return null;
end;
$$;

create trigger community_comments_refresh after insert or delete on public.community_comments
  for each row execute function private.refresh_community_comment_count();

-- When someone edits their profile, their posts and comments show the new
-- name, job and picture.
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
   where author_id = new.id;
  update public.community_comments
     set author_name = v_name, author_title = v_title,
         author_avatar_path = new.avatar_path, author_avatar_preset = new.avatar_preset
   where author_id = new.id;
  return null;
end;
$$;

create trigger profiles_refresh_community after update on public.profiles
  for each row execute function private.refresh_community_author();

-- -----------------------------------------------------------------------------
-- Privileges and row-level security
-- -----------------------------------------------------------------------------
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_votes enable row level security;

revoke all on public.community_posts, public.community_comments, public.community_votes from public, anon, authenticated;

grant select on public.community_posts, public.community_comments to anon, authenticated;
grant insert (author_id, title, body, project_title, project_code, project_href) on public.community_posts to authenticated;
grant insert (post_id, parent_id, author_id, body) on public.community_comments to authenticated;
grant delete on public.community_posts, public.community_comments to authenticated;

grant select on public.community_votes to authenticated;
grant insert (user_id, post_id, comment_id, value) on public.community_votes to authenticated;
grant update (value) on public.community_votes to authenticated;
grant delete on public.community_votes to authenticated;

grant select, insert, update, delete on public.community_posts, public.community_comments, public.community_votes to service_role;

create policy "community posts: anyone reads" on public.community_posts for select to anon, authenticated using (true);
create policy "community posts: write as yourself" on public.community_posts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "community posts: delete your own" on public.community_posts for delete to authenticated
  using (author_id = (select auth.uid()));
create policy "community posts: admins delete" on public.community_posts for delete to authenticated
  using ((select private.is_admin()));

create policy "community comments: anyone reads" on public.community_comments for select to anon, authenticated using (true);
create policy "community comments: write as yourself" on public.community_comments for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "community comments: delete your own" on public.community_comments for delete to authenticated
  using (author_id = (select auth.uid()));
create policy "community comments: admins delete" on public.community_comments for delete to authenticated
  using ((select private.is_admin()));

create policy "community votes: see your own" on public.community_votes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "community votes: vote as yourself" on public.community_votes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "community votes: change your own" on public.community_votes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "community votes: take back your own" on public.community_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Live updates (postgres_changes honours the policies above). Scores change by
-- trigger, so a vote reaches everyone as an update of the post or comment row.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.community_posts;
    alter publication supabase_realtime add table public.community_comments;
  end if;
end $$;
