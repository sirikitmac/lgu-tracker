-- =============================================================================
-- LGU Tracker · Migration · Photos on a citizen concern
-- =============================================================================
-- A reporter can attach up to 4 photos to their report. The metadata already
-- has a home (public.attachments, purpose 'concern_evidence', with RLS and the
-- private.can_upload_attachment rule: only the submitter, only while the report
-- is still 'submitted'). What was missing is the file storage. This adds:
--
--   1. A private Storage bucket, 'report-photos'. Not public: files are only
--      readable through short-lived signed links, and only by people who can
--      read the matching attachments row (the submitter and LGU staff).
--   2. Storage policies so the browser can upload straight to its own folder:
--        reports/{report id}/{your account id}/{uuid}-{name}
--      and only for a report that private.can_upload_attachment allows.
--   3. A guard on attachments for concern photos: images only (JPEG, PNG or
--      WebP), 5 MB each, at most 4 per report.
--
-- Photos are re-encoded in the browser before upload, which also removes the
-- location and device details stored inside a photo (EXIF).
-- =============================================================================

create or replace function private.guard_concern_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  existing integer;
begin
  if new.purpose <> 'concern_evidence' then
    return new;
  end if;

  if new.mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Photos on a report must be JPEG, PNG or WebP images'
      using errcode = '22023';
  end if;

  if new.size_bytes > 5242880 then
    raise exception 'Each photo must be 5 MB or smaller'
      using errcode = '22023';
  end if;

  select count(*) into existing
  from public.attachments a
  where a.report_id = new.report_id and a.purpose = 'concern_evidence';

  if existing >= 4 then
    raise exception 'A report can have at most 4 photos'
      using errcode = '53400';
  end if;

  return new;
end;
$$;

create trigger attachments_concern_photo_guard
  before insert on public.attachments
  for each row execute function private.guard_concern_photo();

revoke execute on function private.guard_concern_photo() from public;
grant execute on function private.guard_concern_photo() to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Storage: the private bucket and its policies. Skipped where Supabase Storage
-- does not exist (plain Postgres in tests that do not model it).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('report-photos', 'report-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Upload into your own folder of a report you may still add photos to.
  -- The CASE keeps the uuid cast from running on a path that is not shaped right.
  execute $p$
    create policy "report photos: upload to your own report folder"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'report-photos'
        and case
          when name ~ '^reports/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$'
          then split_part(name, '/', 3) = (select auth.uid())::text
               and private.can_upload_attachment('concern_evidence', null, null, split_part(name, '/', 2)::uuid)
          else false
        end
      )
  $p$;

  -- Read a photo only when you can read its attachments row (RLS on that table
  -- applies here too): the submitter and LGU staff. You can always see your own
  -- uploads, which is also what lets you clean up one that never got saved.
  execute $p$
    create policy "report photos: read what you can read"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'report-photos'
        and (
          split_part(name, '/', 3) = (select auth.uid())::text
          or exists (select 1 from public.attachments a where a.storage_path = storage.objects.name)
        )
      )
  $p$;

  -- Take back your own upload (cleaning up when a photo did not finish saving).
  execute $p$
    create policy "report photos: remove your own upload"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'report-photos'
        and split_part(name, '/', 3) = (select auth.uid())::text
      )
  $p$;
end $$;
