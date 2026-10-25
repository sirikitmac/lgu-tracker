# LGU Tracker · Database security notes

Decisions and requirements that the migrations depend on but cannot enforce
by themselves. Read this before adding account deletion or file uploads.

## 1. Account deletion and data retention

### What the schema does today

- `profiles.id` references `auth.users` with `ON DELETE CASCADE`.
- `proposals.proposed_by`, `reports.submitted_by`, `comments.author_id` and
  `attachments.uploaded_by` reference `profiles` with `ON DELETE RESTRICT`.
- So **deleting an auth user who has authored anything fails** with a
  foreign-key error (`23503`), both from the Dashboard and the Auth Admin API.
  This is intentional: public-accountability records are never lost as a
  side effect of deleting an account.
- `audit_log.actor_id` has no foreign key, so audit entries survive any
  deletion. `audit_log.old_data` / `new_data` contain full row images,
  including personal data from `profiles` and `reports`.

### Recommended approach

**Offboarding staff, contractors, or council members (deactivate, don't delete)**

1. An administrator sets `profiles.is_active = false`. Every authorization
   helper treats an inactive profile as having no role, so staff and
   contractor access ends immediately.
2. Remove their `project_assignments` rows (audited).
3. Block sign-in with the Auth Admin API from server-side code using the
   service role (for example, `ban_duration`). A deactivated user who can still
   sign in can read public data and their own records, and can edit their own
   still-unhandled reports.

**Citizen data-deletion requests (Data Privacy Act of 2012, RA 10173)**

Anonymize instead of deleting, after the LGU's Data Protection Officer
approves the retention policy:

1. Scrub the profile: `full_name = 'Deleted user'`, and set `position_title`
   and `barangay` to null and `is_active` to false.
2. Replace the auth user's email with a non-routable placeholder and ban the
   account (Auth Admin API, service role).
3. Decide with the DPO whether the *content* of the person's concerns and
   comments is kept, redacted, or hidden (`comments.is_hidden`). Concerns
   about public projects are usually kept, minus personal identifiers.
4. Audit log: the scrub writes new audit rows, but earlier rows still hold
   the old values. Define a retention period for `audit_log` and a
   deliberate, logged purge procedure. Never let the application delete
   audit rows.

Implement this as a dedicated `private.anonymize_user(uuid)` function in a
**new** migration once the policy is agreed. Run it only from the service
role or the SQL editor, and never expose it as an RPC.

Do **not** switch the foreign keys above to `CASCADE` or `SET NULL` to make
deletion easier. That would silently destroy or orphan public records.

## 2. File uploads (Supabase Storage). Required before implementing.

`public.attachments` holds metadata only. The database already enforces
the following on that metadata:

- **Purpose and scope** (`attachments.purpose`, `private.can_upload_attachment`):
  | Purpose | Parent | Who may upload |
  |---|---|---|
  | `proposal_document` | proposal | planning officer who proposed it, until decided |
  | `decision_document` | proposal | authorized council decider, not on own proposal, non-draft |
  | `budget_document` | project | budget officer |
  | `procurement_document` | project | BAC member |
  | `inspection_evidence` | inspection report | handlers of the project or its `inspector` assignees |
  | `progress_evidence` | progress report | project assignees and handlers |
  | `monitoring_evidence` | project | the project's `monitor` assignees |
  | `concern_evidence` | citizen concern | its submitter, while still `submitted` |

  Administrators may upload any purpose. No other staff role has any upload
  path. Only staff may mark an upload public (`stamp_attachment`); everything
  else starts private.
- **Path** (`attachments_storage_path_check`):
  `{projects|proposals|reports}/{parent_id}/{uploaded_by}/{uuid}-{safe_name}`.
  The path must name the row's own parent and uploader, so nobody can claim or
  squat another record's or user's folder.
- **Declared type and size**: PDF, JPEG, PNG, WebP, DOCX, XLSX; 1 byte to 25 MiB.

What is **not** enforced yet, because Storage isn't set up: the bytes that
are actually uploaded. A metadata row proves nothing about the object until
the policies below exist, so Storage access must **not** be granted just
because a matching `attachments` row exists.

### Buckets

- One **private** bucket (e.g. `attachments`). Serve files through short-lived
  signed URLs that a server action creates after checking the `attachments`
  RLS. If public downloads are needed, staff copy approved files into a
  separate public bucket. Never make the upload bucket public.
- Set `file_size_limit` and `allowed_mime_types` on the bucket. Don't trust
  the client-supplied `mime_type` column. Refuse or force-download types
  that can carry script (`text/html`, `image/svg+xml`, `application/xhtml+xml`).
  Consider malware scanning for documents.

### `storage.objects` policies

- **INSERT**: `bucket_id = 'attachments'`, and
  `(storage.foldername(name))[3] = auth.uid()::text`, and a matching
  `attachments` row (same `storage_path`, `uploaded_by = auth.uid()`) already
  exists. Insert the metadata first, so `private.can_upload_attachment` has
  already approved the purpose and scope.
- **SELECT**: only if an `attachments` row exists with `storage_path = name`
  **and** `uploaded_by` equals the uploader segment of `name`, **and** that
  row is visible to the caller under `attachments` RLS. Run the check as a
  subquery so RLS applies.
- **UPDATE**: none (re-upload instead). **DELETE**: uploader or admin, as for
  the metadata row.

### Lifecycle

- Upload the object and insert the metadata in one server action. A
  scheduled job removes objects with no metadata row older than 24 h.
- Deleting a project, proposal, or report cascades to `attachments` rows,
  not to Storage objects. Delete the objects in the same server action, or
  let the cleanup job do it.
- Only staff can create public attachments (`stamp_attachment`). There is no
  UPDATE policy, so `is_public` cannot be changed later through the API.

## 3. Adding tables in later migrations

Supabase's default privileges still grant new `public` tables to `anon` and
`authenticated`. Every new table needs, in the same migration:
`enable row level security`, an explicit `revoke all ... from anon,
authenticated`, then only the grants its policies need, mirroring migration 4.

## 4. Nationwide DPWH sync (migration 20261026000100)

- `dpwh_contracts` and `dpwh_directory_stats` are publicly readable: they hold
  CC0 public-sector records (BetterGov.ph's snapshot of the DPWH Transparency
  Portal). `dpwh_sync_runs` is admin-only; `dpwh_contract_reviews` (LGU-entered
  verification) is staff-only and writable by admins, planning officers, and
  project engineers. The sync never writes the reviews table.
- No end-user role can write the source tables. The only write path is the
  `dpwh_sync_*` SECURITY DEFINER functions, which admit an active
  super_admin / lgu_admin or the service role. Inside SECURITY DEFINER,
  `current_user` is the owner, so `private.is_end_user_request()` must not be
  used as a gate there; `private.can_run_dpwh_sync()` checks the verified JWT.
- The service-role key (`SUPABASE_SECRET_KEY`) is used only by
  `src/lib/supabase/admin.ts` (`server-only`) for `/api/cron/dpwh-sync`, which
  first checks `Authorization: Bearer $CRON_SECRET` in constant time and fails
  closed when the secret is missing. The manual sync route runs as the
  signed-in admin and needs no service key.
- Nothing in the sync deletes contracts. A failed or partial run leaves every
  previously stored record in place.

## 5. Other BetterGov.ph sources (migration 20261028000100)

- `infrastructure_projects` and the `project_directory` view are publicly
  readable (public budget / project records). `source_sync_runs` is admin-only.
  No end-user role can write them; the only write path is the `source_sync_*`
  SECURITY DEFINER functions, gated by the same `private.can_run_dpwh_sync()`
  check as the DPWH sync (active super_admin / lgu_admin, or the service role).
- `sync_storage_usage()` returns the database size to admins and the service
  role only, for the sync's storage guard.
- `project_directory` is `security_invoker`, so callers see only what RLS on
  `dpwh_contracts` and `infrastructure_projects` allows. It never exposes
  `dpwh_contract_reviews`.
- `/api/cron/bettergov-sync` uses the same `CRON_SECRET` check as the DPWH cron.
- Nothing here deletes records; a narrower DPWH scope leaves already-stored
  contracts in place.
