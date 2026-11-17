-- =============================================================================
-- Role pills
-- =============================================================================
-- A small coloured pill beside a person's name in Community and on their
-- profile.
--
--   * Super Admin, Admin and Government Employee each have a default pill
--     (purple, red, green). Citizens and contractors have none.
--   * Any administrator can change the label and colour of those three
--     (public.role_badge_styles). The change shows everywhere at once.
--   * An administrator can also give THEMSELVES a custom pill (a label and a
--     colour on their own profile). Nobody else can, and it is dropped if the
--     account stops being an administrator.
--   * Community rows store only the pill's kind plus a custom label/colour
--     when there is one, so a colour change needs no rewrite of old rows.
--     Anonymous items carry no pill at all.
-- =============================================================================

create or replace function private.badge_tier(r public.app_role)
returns text
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'super_admin' then 'super_admin'
    when 'lgu_admin'   then 'admin'
    when 'citizen'     then null
    when 'contractor'  then null
    else 'employee'
  end;
$$;

-- The custom pill counts only for an administrator who set both parts.
create or replace function private.badge_custom_label(r public.app_role, label text, color text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when r in ('super_admin', 'lgu_admin') and label is not null and color is not null then label end;
$$;

create or replace function private.badge_custom_color(r public.app_role, label text, color text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when r in ('super_admin', 'lgu_admin') and label is not null and color is not null then color end;
$$;

-- -----------------------------------------------------------------------------
-- The three editable default pills.
-- -----------------------------------------------------------------------------
create table public.role_badge_styles (
  tier        text primary key check (tier in ('super_admin', 'admin', 'employee')),
  label       text not null check (char_length(btrim(label)) between 1 and 24),
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

insert into public.role_badge_styles (tier, label, color) values
  ('super_admin', 'Super Admin', '#7C3AED'),
  ('admin',       'Admin',       '#DC2626'),
  ('employee',    'LGU',         '#16A34A');

create or replace function private.stamp_role_badge_style()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.label := btrim(new.label);
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger role_badge_styles_stamp before update on public.role_badge_styles
  for each row execute function private.stamp_role_badge_style();

alter table public.role_badge_styles enable row level security;
revoke all on public.role_badge_styles from public, anon, authenticated;
grant select on public.role_badge_styles to anon, authenticated;
grant update (label, color) on public.role_badge_styles to authenticated;
grant select, insert, update, delete on public.role_badge_styles to service_role;

create policy "role badges: anyone reads" on public.role_badge_styles for select to anon, authenticated using (true);
create policy "role badges: administrators edit" on public.role_badge_styles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- An administrator's own custom pill, on the profile.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column badge_label text check (badge_label is null or char_length(btrim(badge_label)) between 1 and 24),
  add column badge_color text check (badge_color is null or badge_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint profiles_badge_complete check ((badge_label is null) = (badge_color is null));

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
            'avatar_path', 'avatar_preset', 'badge_label', 'badge_color'],
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

    -- A custom pill is yours alone: an administrator can set their own, never
    -- someone else's, and it goes when the account stops being an administrator.
    if new.id <> (select auth.uid())
       and (new.badge_label is distinct from old.badge_label or new.badge_color is distinct from old.badge_color) then
      raise exception 'Permission denied: you can only change your own badge' using errcode = '42501';
    end if;
    if new.role not in ('super_admin', 'lgu_admin') then
      new.badge_label := null;
      new.badge_color := null;
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
-- Community: the author's pill, copied onto each item like the name and photo.
-- -----------------------------------------------------------------------------
alter table public.community_posts
  add column author_badge_tier  text check (author_badge_tier in ('super_admin', 'admin', 'employee')),
  add column author_badge_label text check (author_badge_label is null or char_length(author_badge_label) <= 24),
  add column author_badge_color text check (author_badge_color is null or author_badge_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.community_comments
  add column author_badge_tier  text check (author_badge_tier in ('super_admin', 'admin', 'employee')),
  add column author_badge_label text check (author_badge_label is null or char_length(author_badge_label) <= 24),
  add column author_badge_color text check (author_badge_color is null or author_badge_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.community_posts drop constraint community_posts_anonymous_shape;
alter table public.community_posts add constraint community_posts_anonymous_shape
  check (not is_anonymous or (author_id is null and sample_author is null and not is_sample
         and author_title is null and author_avatar_path is null and author_avatar_preset is null
         and author_badge_tier is null and author_badge_label is null and author_badge_color is null));
alter table public.community_comments drop constraint community_comments_anonymous_shape;
alter table public.community_comments add constraint community_comments_anonymous_shape
  check (not is_anonymous or (author_id is null and sample_author is null and not is_sample
         and author_title is null and author_avatar_path is null and author_avatar_preset is null
         and author_badge_tier is null and author_badge_label is null and author_badge_color is null));

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

  select pr.full_name, pr.position_title, pr.avatar_path, pr.avatar_preset,
         pr.role, pr.badge_label, pr.badge_color
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
    new.author_badge_tier := null;
    new.author_badge_label := null;
    new.author_badge_color := null;
  else
    new.author_name := left(coalesce(nullif(btrim(regexp_replace(p.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80);
    new.author_title := left(nullif(btrim(p.position_title), ''), 60);
    new.author_avatar_path := p.avatar_path;
    new.author_avatar_preset := p.avatar_preset;
    new.author_badge_tier := private.badge_tier(p.role);
    new.author_badge_label := private.badge_custom_label(p.role, p.badge_label, p.badge_color);
    new.author_badge_color := private.badge_custom_color(p.role, p.badge_label, p.badge_color);
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

  select pr.full_name, pr.position_title, pr.avatar_path, pr.avatar_preset,
         pr.role, pr.badge_label, pr.badge_color
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
    new.author_badge_tier := null;
    new.author_badge_label := null;
    new.author_badge_color := null;
  else
    new.author_name := left(coalesce(nullif(btrim(regexp_replace(p.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80);
    new.author_title := left(nullif(btrim(p.position_title), ''), 60);
    new.author_avatar_path := p.avatar_path;
    new.author_avatar_preset := p.avatar_preset;
    new.author_badge_tier := private.badge_tier(p.role);
    new.author_badge_label := private.badge_custom_label(p.role, p.badge_label, p.badge_color);
    new.author_badge_color := private.badge_custom_color(p.role, p.badge_label, p.badge_color);
  end if;
  return new;
end;
$$;

-- Items already posted get their author's current pill.
update public.community_posts x
   set author_badge_tier  = private.badge_tier(p.role),
       author_badge_label = private.badge_custom_label(p.role, p.badge_label, p.badge_color),
       author_badge_color = private.badge_custom_color(p.role, p.badge_label, p.badge_color)
  from public.profiles p
 where x.author_id = p.id and not x.is_anonymous and not x.is_sample;
update public.community_comments x
   set author_badge_tier  = private.badge_tier(p.role),
       author_badge_label = private.badge_custom_label(p.role, p.badge_label, p.badge_color),
       author_badge_color = private.badge_custom_color(p.role, p.badge_label, p.badge_color)
  from public.profiles p
 where x.author_id = p.id and not x.is_anonymous and not x.is_sample;

-- A profile edit or role change refreshes the author's named items.
create or replace function private.refresh_community_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text := left(coalesce(nullif(btrim(regexp_replace(new.full_name, '\s+', ' ', 'g')), ''), 'Community member'), 80);
  v_title text := left(nullif(btrim(new.position_title), ''), 60);
  v_tier  text := private.badge_tier(new.role);
  v_label text := private.badge_custom_label(new.role, new.badge_label, new.badge_color);
  v_color text := private.badge_custom_color(new.role, new.badge_label, new.badge_color);
begin
  if (new.full_name, new.position_title, new.avatar_path, new.avatar_preset, new.role, new.badge_label, new.badge_color)
     is not distinct from (old.full_name, old.position_title, old.avatar_path, old.avatar_preset, old.role, old.badge_label, old.badge_color) then
    return null;
  end if;
  update public.community_posts
     set author_name = v_name, author_title = v_title,
         author_avatar_path = new.avatar_path, author_avatar_preset = new.avatar_preset,
         author_badge_tier = v_tier, author_badge_label = v_label, author_badge_color = v_color
   where author_id = new.id and not is_anonymous;
  update public.community_comments
     set author_name = v_name, author_title = v_title,
         author_avatar_path = new.avatar_path, author_avatar_preset = new.avatar_preset,
         author_badge_tier = v_tier, author_badge_label = v_label, author_badge_color = v_color
   where author_id = new.id and not is_anonymous;
  if new.full_name is distinct from old.full_name then
    update public.community_anonymous_authors set author_name = v_name where author_id = new.id;
  end if;
  return null;
end;
$$;
