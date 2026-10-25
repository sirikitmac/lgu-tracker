-- =============================================================================
-- LGU Tracker · RLS and authorization tests (pgTAP)
-- Run locally with:  npx supabase test db
-- Everything runs inside a transaction and is rolled back. Fixtures are
-- self-contained and do not depend on seed.sql.
-- =============================================================================
begin;
select plan(121);

-- -----------------------------------------------------------------------------
-- Fixtures (as the postgres superuser; guard triggers are skipped)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'citizen@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'citizen2@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'contractor@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'engineer@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'budget@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'planner@test.local'),
  ('77777777-7777-7777-7777-777777777777', 'lgu-admin@test.local'),
  ('88888888-8888-8888-8888-888888888888', 'council@test.local'),
  ('99999999-9999-9999-9999-999999999999', 'assigned-engineer@test.local'),
  ('12121212-1212-1212-1212-121212121212', 'council-unauthorized@test.local'),
  ('13131313-1313-1313-1313-131313131313', 'council2@test.local'),
  ('14141414-1414-1414-1414-141414141414', 'monitor@test.local'),
  ('15151515-1515-1515-1515-151515151515', 'inspector@test.local'),
  ('16161616-1616-1616-1616-161616161616', 'bac@test.local');

insert into public.organizations (id, name, org_type)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Test Contractor Org', 'contractor');
insert into public.organization_contacts (organization_id, contact_email)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'contact@test.local');

update public.profiles set role = 'contractor', organization_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'project_engineer' where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set role = 'budget_officer'   where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set role = 'planning_officer' where id = '66666666-6666-6666-6666-666666666666';
update public.profiles set role = 'lgu_admin'        where id = '77777777-7777-7777-7777-777777777777';
update public.profiles set role = 'council_member', can_decide_proposals = true
  where id in ('88888888-8888-8888-8888-888888888888', '13131313-1313-1313-1313-131313131313');
update public.profiles set role = 'council_member'   where id = '12121212-1212-1212-1212-121212121212';
update public.profiles set role = 'project_engineer', full_name = 'Engr. Test Assigned', position_title = 'CEO'
  where id = '99999999-9999-9999-9999-999999999999';
-- The monitor holds a council role; only the explicit 'monitor' assignment
-- below gives them concern access. The inspector has no staff role at all.
update public.profiles set role = 'council_member'   where id = '14141414-1414-1414-1414-141414141414';
update public.profiles set role = 'contractor'       where id = '15151515-1515-1515-1515-151515151515';
update public.profiles set role = 'bac_member'       where id = '16161616-1616-1616-1616-161616161616';

insert into public.projects (id, reference_code, title, category, barangay, visibility, allocated_budget) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'TEST-PUB-001', 'Published Test Project',
   'infrastructure_public_works', 'Barangay Test', 'published', 1000000),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'TEST-DRAFT-001', 'Draft Test Project',
   'health_sanitation', 'Barangay Test', 'draft', 500000),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'TEST-DRAFT-002', 'Deletable Draft Project',
   'health_sanitation', 'Barangay Test', 'draft', 100000);

-- Draft project 2: the contractor organization and engineer 9999.
-- Published project 1: monitor 1414 and inspector 1515. Engineer 4444: nothing.
insert into public.project_assignments (project_id, organization_id, assignment_role)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'contractor');
insert into public.project_assignments (project_id, user_id, assignment_role) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999', 'engineer'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '14141414-1414-1414-1414-141414141414', 'monitor'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '15151515-1515-1515-1515-151515151515', 'inspector');

insert into public.project_milestones (id, project_id, title, sort_order)
values ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Site mobilization', 1);

-- Private citizen concerns: on the published project, on the assigned draft
-- project, and on the deletable draft project.
insert into public.reports (id, project_id, title, body, submitted_by) values
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Dust at site', 'Dust from the works', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002',
   'Blocked drain', 'Drain blocked near site', '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000003',
   'Noise at night', 'Works continue after 10pm', '11111111-1111-1111-1111-111111111111');

-- Proposals by the planner (1, 2, 3) and one by council member 8888 (4).
insert into public.proposals (id, title, category, barangay, status, proposed_by) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Submitted proposal', 'health_sanitation',
   'Barangay Test', 'submitted', '66666666-6666-6666-6666-666666666666'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Draft proposal', 'health_sanitation',
   'Barangay Test', 'draft', '66666666-6666-6666-6666-666666666666'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'Second submitted proposal', 'health_sanitation',
   'Barangay Test', 'submitted', '66666666-6666-6666-6666-666666666666'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'Council member''s own proposal', 'health_sanitation',
   'Barangay Test', 'submitted', '88888888-8888-8888-8888-888888888888');

-- -----------------------------------------------------------------------------
-- Privileges (explicit grants)
-- -----------------------------------------------------------------------------
select ok(not has_table_privilege('anon', 'public.projects', 'INSERT, UPDATE, DELETE, TRUNCATE'),
  'anon has no write privileges on projects');
select ok(has_table_privilege('authenticated', 'public.projects', 'SELECT')
      and has_table_privilege('authenticated', 'public.projects', 'INSERT')
      and has_table_privilege('authenticated', 'public.projects', 'UPDATE')
      and has_table_privilege('authenticated', 'public.projects', 'DELETE'),
  'authenticated has the explicit CRUD privileges RLS governs on projects');
select ok(not has_table_privilege('authenticated', 'public.projects', 'TRUNCATE, REFERENCES, TRIGGER'),
  'authenticated has no TRUNCATE/REFERENCES/TRIGGER');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', 'public.project_status_history', 'INSERT, UPDATE, DELETE'),
  'authenticated cannot write the audit log or status history');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT, DELETE'),
  'authenticated cannot insert or delete profiles');
select ok(not has_table_privilege('authenticated', 'public.project_assignments', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.attachments', 'UPDATE'),
  'authenticated cannot update assignments or attachments');
select ok(not has_table_privilege('authenticated', 'public.proposal_decisions', 'UPDATE, DELETE')
      and not has_table_privilege('anon', 'public.proposal_decisions', 'SELECT'),
  'proposal decisions are append-only and not public');
select ok(has_schema_privilege('service_role', 'private', 'USAGE'),
  'service_role can use the private schema');
select ok(has_function_privilege('service_role', 'private.is_end_user_request()', 'EXECUTE'),
  'service_role can execute the private helpers');
select ok(not has_function_privilege('anon',
    'public.change_project_status(uuid, public.project_status, public.lifecycle_stage, text)', 'EXECUTE'),
  'anon cannot execute change_project_status');
select hasnt_column('public', 'organizations', 'contact_email',
  'contact_email is not on the publicly readable organizations table');

-- -----------------------------------------------------------------------------
-- Anonymous visitor
-- -----------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '', true);

select ok(exists (select 1 from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'anon can read a published project');
select ok(not exists (select 1 from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'anon cannot read a draft project');
select throws_ok(
  $$insert into public.projects (reference_code, title, category, barangay)
    values ('ANON-001', 'Anon project', 'health_sanitation', 'Barangay Test')$$,
  '42501', null, 'anon cannot insert projects');
select throws_ok(
  $$insert into public.project_status_history (project_id, to_status, to_stage)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'completed', 'completion')$$,
  '42501', null, 'anon cannot write status history');
select lives_ok($$select count(*) from public.comments$$,
  'anon can query comments (policy subqueries have the privileges they need)');
select throws_ok($$select contact_email from public.organization_contacts$$,
  '42501', null, 'anon cannot read organization contact details');
reset role;

-- -----------------------------------------------------------------------------
-- Citizen
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$update public.profiles set role = 'super_admin' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'citizen cannot escalate their own role');
select lives_ok(
  $$update public.profiles set full_name = 'Juan Dela Cruz' where id = '11111111-1111-1111-1111-111111111111'$$,
  'citizen can update their own name');
select is((select count(*)::int from public.profiles), 1, 'citizen sees only their own profile');
select lives_ok(
  $$insert into public.reports (id, title, body, is_public, status)
    values ('cccccccc-0000-0000-0000-000000000001', 'Pothole near school', 'Large pothole on the access road', true, 'resolved')$$,
  'citizen can submit a concern');
select results_eq(
  $$select status::text, is_public, shared_with_contractor
      from public.reports where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  $$values ('submitted'::text, false, false)$$,
  'new concern is forced to submitted + private + unshared');
select is((select count(*)::int from public.audit_log), 0, 'citizen cannot read the audit log');
select throws_ok(
  $$insert into public.proposals (title, category, barangay)
    values ('Citizen proposal', 'health_sanitation', 'Barangay Test')$$,
  '42501', null, 'citizen cannot create proposals');
select is((select count(*)::int from public.organization_contacts), 0,
  'citizen cannot read organization contact details');

-- Attachments on their own concern (decision 3)
select lives_ok(
  $$insert into public.attachments (report_id, purpose, storage_path, file_name, mime_type, size_bytes, is_public)
    values ('cccccccc-0000-0000-0000-000000000001', 'concern_evidence',
            'reports/cccccccc-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111/f0000000-0000-0000-0000-000000000006-pothole.jpg',
            'pothole.jpg', 'image/jpeg', 120000, true)$$,
  'citizen can attach evidence to their own unhandled concern');
select is(
  (select is_public from public.attachments
    where storage_path like '%f0000000-0000-0000-0000-000000000006-pothole.jpg'),
  false, 'citizen attachments are private by default even if requested public');
select throws_ok(
  $$insert into public.attachments (report_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('cccccccc-0000-0000-0000-000000000001', 'concern_evidence',
            'reports/cccccccc-0000-0000-0000-000000000001/22222222-2222-2222-2222-222222222222/f0000000-0000-0000-0000-000000000007-x.jpg',
            'x.jpg', 'image/jpeg', 1000)$$,
  '23514', null, 'storage path must be in the uploader''s own folder');
select throws_ok(
  $$insert into public.attachments (report_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('cccccccc-0000-0000-0000-000000000001', 'concern_evidence',
            'reports/cccccccc-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111/f0000000-0000-0000-0000-000000000009-x.html',
            'x.html', 'text/html', 1000)$$,
  '23514', null, 'disallowed file types are rejected');

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select ok(not exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000001'),
  'another citizen cannot see a private concern');
select throws_ok(
  $$insert into public.attachments (report_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('cccccccc-0000-0000-0000-000000000001', 'concern_evidence',
            'reports/cccccccc-0000-0000-0000-000000000001/22222222-2222-2222-2222-222222222222/f0000000-0000-0000-0000-000000000008-x.jpg',
            'x.jpg', 'image/jpeg', 1000)$$,
  '42501', null, 'a citizen cannot attach files to someone else''s concern');
reset role;

set local role anon;
select set_config('request.jwt.claims', '', true);
select ok(not exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000001'),
  'anon cannot see a private concern');
reset role;

-- -----------------------------------------------------------------------------
-- Contractor (organization assigned to the draft project only)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

select ok(exists (select 1 from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'contractor sees a draft project assigned to their organization');
select lives_ok(
  $$update public.projects set title = 'Tampered' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  'contractor project update is silently filtered by RLS');
select lives_ok(
  $$insert into public.reports (id, project_id, report_type, title, body, reported_progress)
    values ('cccccccc-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002',
            'progress_report', 'Week 1 progress', 'Site mobilized', 20)$$,
  'contractor can file a progress report on an assigned project');
select throws_ok(
  $$insert into public.reports (project_id, report_type, title, body)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'progress_report', 'Fake report', 'Not my project')$$,
  '42501', null, 'contractor cannot file a progress report on an unassigned project');
select ok(not exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000003'),
  'contractor cannot read an unshared concern on their own project');
reset role;

select is((select title from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'Draft Test Project', 'contractor update had no effect');

-- -----------------------------------------------------------------------------
-- Budget officer and BAC member (no private concerns)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);

select lives_ok(
  $$update public.projects set disbursed_budget = 250000 where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'budget officer can update budget figures');
select throws_ok(
  $$update public.projects set title = 'Renamed' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  '42501', null, 'budget officer cannot change the project title');
select lives_ok(
  $$update public.projects set disbursed_budget = 260000, published_at = '2000-01-01T00:00:00Z'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'budget officer update that includes published_at is accepted');
select ok(not exists (select 1 from public.reports where report_type = 'citizen_concern'),
  'budget officer cannot read private citizen concerns');

select set_config('request.jwt.claims',
  '{"sub":"16161616-1616-1616-1616-161616161616","role":"authenticated"}', true);
select ok(not exists (select 1 from public.reports where report_type = 'citizen_concern'),
  'BAC member cannot read private citizen concerns');
reset role;

select ok((select published_at from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000001')
          is distinct from '2000-01-01T00:00:00Z'::timestamptz,
  'budget officer cannot change published_at');

-- -----------------------------------------------------------------------------
-- Council member (oversight: proposals and progress, not private data)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);

select ok(not exists (select 1 from public.reports where report_type = 'citizen_concern'),
  'council member cannot read private citizen concerns');
select is((select count(*)::int from public.profiles), 1, 'council member sees only their own profile');
select ok(exists (select 1 from public.proposals where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'council member can read a submitted proposal');
select ok(not exists (select 1 from public.proposals where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  'council member cannot read another user''s draft proposal');
select lives_ok(
  $$insert into public.comments (proposal_id, body, visibility)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'Council review note', 'internal')$$,
  'council member can post an internal review comment on a submitted proposal');
select ok(exists (select 1 from public.reports where report_type = 'progress_report'),
  'council member can read progress reports');
reset role;

-- -----------------------------------------------------------------------------
-- Monitor (council role + explicit 'monitor' assignment on project 1)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"14141414-1414-1414-1414-141414141414","role":"authenticated"}', true);

select ok(exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000002'),
  'monitor can read a concern on the project they monitor');
select ok(not exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000003'),
  'monitor cannot read concerns on other projects');
select lives_ok(
  $$update public.reports set is_public = true where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  'monitor concern update is silently filtered by RLS (read-only access)');
reset role;

-- -----------------------------------------------------------------------------
-- Inspector (no staff role + explicit 'inspector' assignment on project 1)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"15151515-1515-1515-1515-151515151515","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.reports (project_id, report_type, title, body)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'inspection_report', 'Site inspection', 'Rebar spacing OK')$$,
  'inspector can file an inspection report on the assigned project');
select ok(not exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000002'),
  'inspector cannot read private concerns');
reset role;

-- -----------------------------------------------------------------------------
-- Project engineer NOT assigned to any project
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

select throws_ok(
  $$select public.change_project_status('bbbbbbbb-0000-0000-0000-000000000001', 'delayed', null, 'x')$$,
  '42501', null, 'unassigned engineer cannot change project status');
select ok(not exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000002'),
  'unassigned engineer cannot read a private concern on another project');
select lives_ok(
  $$update public.reports set status = 'acknowledged', is_public = true
     where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  'unassigned engineer concern update is silently filtered by RLS');
select throws_ok(
  $$insert into public.reports (project_id, report_type, title, body)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'inspection_report', 'Inspection', 'Not assigned')$$,
  '42501', null, 'unassigned engineer cannot file an inspection report');
reset role;

select results_eq(
  $$select status::text, is_public from public.reports where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  $$values ('submitted'::text, false)$$,
  'neither the monitor nor the unassigned engineer could modify or publish the concern');

-- -----------------------------------------------------------------------------
-- Project engineer assigned to the draft project
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);

select ok(exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000003'),
  'assigned engineer can read a concern on their project');
select throws_ok(
  $$update public.reports set status = 'acknowledged', handled_by = '77777777-7777-7777-7777-777777777777'
     where id = 'cccccccc-0000-0000-0000-000000000003'$$,
  '42501', null, 'assigned engineer cannot spoof handled_by');
select lives_ok(
  $$update public.reports set status = 'acknowledged' where id = 'cccccccc-0000-0000-0000-000000000003'$$,
  'assigned engineer can acknowledge a concern on their project');
select throws_ok(
  $$update public.reports set project_id = 'bbbbbbbb-0000-0000-0000-000000000001'
     where id = 'cccccccc-0000-0000-0000-000000000003'$$,
  '42501', null, 'assigned engineer cannot move a concern to an unassigned project');
select lives_ok(
  $$update public.reports set shared_with_contractor = true where id = 'cccccccc-0000-0000-0000-000000000003'$$,
  'assigned engineer can share a concern with the project''s contractor');
select lives_ok(
  $$update public.project_milestones
       set is_completed = true,
           verified_by = '77777777-7777-7777-7777-777777777777',
           verified_by_name = 'Mayor',
           completed_at = '2000-01-01T00:00:00Z'
     where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  'assigned engineer can complete a milestone');
select lives_ok(
  $$update public.project_milestones
       set verified_by = '77777777-7777-7777-7777-777777777777', completed_at = '2000-01-01T00:00:00Z'
     where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  'editing a completed milestone''s verification fields is accepted but ignored');
reset role;

select results_eq(
  $$select status::text, handled_by, resolved_at is null
      from public.reports where id = 'cccccccc-0000-0000-0000-000000000003'$$,
  $$values ('acknowledged'::text, '99999999-9999-9999-9999-999999999999'::uuid, true)$$,
  'handled_by is set by the database to the acting handler');
select results_eq(
  $$select verified_by, verified_by_name, completed_at = now()
      from public.project_milestones where id = 'dddddddd-0000-0000-0000-000000000001'$$,
  $$values ('99999999-9999-9999-9999-999999999999'::uuid, 'Engr. Test Assigned (CEO)'::text, true)$$,
  'verified_by, verified_by_name and completed_at cannot be spoofed');
select ok(exists (select 1 from public.audit_log
                   where table_name = 'project_milestones'
                     and record_id = 'dddddddd-0000-0000-0000-000000000001'),
  'milestone changes are audited');

-- The contractor can now read the concern that was explicitly shared.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select ok(exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000003'),
  'contractor can read a concern a handler shared with them');
reset role;

-- -----------------------------------------------------------------------------
-- Planning officer (not assigned to any project)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);

select lives_ok(
  $$select public.change_project_status('bbbbbbbb-0000-0000-0000-000000000001', 'in_progress',
      'implementation', 'Notice to Proceed issued')$$,
  'planning officer can change project status');
select ok((select count(*) from public.profiles) > 1, 'planning officer can read the user directory');
select is((select count(*)::int from public.organization_contacts), 1,
  'staff can read organization contact details');
select lives_ok(
  $$insert into public.projects (id, reference_code, title, category, barangay, visibility, published_at)
    values ('bbbbbbbb-0000-0000-0000-000000000004', 'TEST-PLAN-001', 'Planner Project',
            'health_sanitation', 'Barangay Test', 'published', '2000-01-01T00:00:00Z')$$,
  'planning officer can create a published project');
select ok(exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000001'),
  'planning officer can read the unlinked concern intake queue');
select ok(not exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000002'),
  'planning officer cannot read concerns on projects not assigned to them');
select throws_ok(
  $$insert into public.project_assignments (project_id, user_id, assignment_role)
    values ('bbbbbbbb-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'monitor')$$,
  '42501', null, 'planning officer cannot assign themselves to a project');
reset role;

select results_eq(
  $$select from_status::text, to_status::text, note
      from public.project_status_history
     where project_id = 'bbbbbbbb-0000-0000-0000-000000000001'
     order by id desc limit 1$$,
  $$values ('planned'::text, 'in_progress'::text, 'Notice to Proceed issued'::text)$$,
  'status change is recorded in history with its note');
select ok((select published_at from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000004') = now(),
  'published_at on insert is set by the database, not the client');

-- -----------------------------------------------------------------------------
-- Proposals and Development Council decisions (decision 1)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.proposals (title, category, barangay, status)
    values ('New planner proposal', 'health_sanitation', 'Barangay Test', 'submitted')$$,
  'planning officer can create and submit a proposal');
select throws_ok(
  $$update public.proposals set status = 'approved' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '42501', null, 'a proposal cannot be approved by setting its status');

select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.proposals (title, category, barangay)
    values ('Budget proposal', 'health_sanitation', 'Barangay Test')$$,
  '42501', null, 'non-planner staff cannot create proposals');

-- Council member without decision authority
select set_config('request.jwt.claims',
  '{"sub":"12121212-1212-1212-1212-121212121212","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.proposal_decisions (proposal_id, decision, reason)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'approved', 'Looks good to me')$$,
  '42501', null, 'unauthorized council member cannot record a decision');
select throws_ok(
  $$update public.profiles set can_decide_proposals = true where id = '12121212-1212-1212-1212-121212121212'$$,
  '42501', null, 'council member cannot grant themselves decision authority');

-- Authorized council member 8888
select set_config('request.jwt.claims',
  '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.proposal_decisions (proposal_id, decision, reason)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'approved', '   ')$$,
  '23514', null, 'a decision requires a reason');
select lives_ok(
  $$insert into public.proposal_decisions (proposal_id, decision, reason, decided_by, is_decisive)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'approved', 'Aligned with the AIP priorities',
            '13131313-1313-1313-1313-131313131313', false)$$,
  'authorized council member can approve a submitted proposal');
select throws_ok(
  $$insert into public.proposal_decisions (proposal_id, decision, reason)
    values ('eeeeeeee-0000-0000-0000-000000000004', 'approved', 'Approving my own proposal')$$,
  '42501', null, 'council member cannot decide their own proposal');
select throws_ok(
  $$insert into public.proposal_decisions (proposal_id, decision, reason)
    values ('eeeeeeee-0000-0000-0000-000000000002', 'approved', 'Approving a draft')$$,
  '55000', null, 'a draft proposal is not open for a decision');
select throws_ok(
  $$insert into public.proposal_decisions (proposal_id, decision, reason, is_override)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'rejected', 'Overriding as council', true)$$,
  '42501', null, 'council member cannot record an administrative override');
select throws_ok(
  $$update public.proposal_decisions set decision = 'rejected'
     where proposal_id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '42501', null, 'recorded decisions cannot be edited');
select throws_ok(
  $$delete from public.proposal_decisions where proposal_id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '42501', null, 'recorded decisions cannot be deleted');
reset role;

select results_eq(
  $$select p.status::text, p.reviewed_by, d.decided_by, d.is_decisive
      from public.proposals p
      join public.proposal_decisions d on d.proposal_id = p.id
     where p.id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('approved'::text, '88888888-8888-8888-8888-888888888888'::uuid,
            '88888888-8888-8888-8888-888888888888'::uuid, true)$$,
  'the first decision is decisive and decided_by / is_decisive cannot be spoofed');

-- A second authorized council member disagrees later.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"13131313-1313-1313-1313-131313131313","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.proposal_decisions (proposal_id, decision, reason)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'rejected', 'Budget estimate is too low')$$,
  'a later conflicting decision is recorded');
reset role;

select results_eq(
  $$select p.status::text,
           (select count(*)::int from public.proposal_decisions d
             where d.proposal_id = p.id and d.decision = 'rejected' and not d.is_decisive)
      from public.proposals p where p.id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('approved'::text, 1)$$,
  'the later conflicting decision is kept as non-decisive and does not change the outcome');

-- The proposer cannot edit a decided proposal.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select throws_ok(
  $$update public.proposals set title = 'Edited after approval' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  '42501', null, 'a decided proposal cannot be edited');

-- LGU administrator
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select lives_ok(
  $$update public.profiles set can_decide_proposals = true where id = '12121212-1212-1212-1212-121212121212'$$,
  'lgu_admin can grant a council member decision authority');
select throws_ok(
  $$update public.proposals set status = 'approved' where id = 'eeeeeeee-0000-0000-0000-000000000003'$$,
  '42501', null, 'an administrator cannot approve by setting the status either');
select lives_ok(
  $$insert into public.proposal_decisions (proposal_id, decision, reason, is_override)
    values ('eeeeeeee-0000-0000-0000-000000000001', 'rejected',
            'Override: funding source withdrawn by the Sanggunian', true)$$,
  'lgu_admin can record an explicit override with a reason');
reset role;

select results_eq(
  $$select status::text, reviewed_by from public.proposals where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  $$values ('rejected'::text, '77777777-7777-7777-7777-777777777777'::uuid)$$,
  'the administrator override replaces the outcome');
select ok(exists (
    select 1 from public.audit_log a
    join public.proposal_decisions d on d.id = a.record_id
    where a.table_name = 'proposal_decisions' and d.is_override and d.is_decisive
      and a.actor_id = '77777777-7777-7777-7777-777777777777'),
  'the override is audited with the administrator as actor');

-- -----------------------------------------------------------------------------
-- Attachment uploads tied to purpose and scope (decision 3)
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.attachments (project_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'budget_document',
            'projects/bbbbbbbb-0000-0000-0000-000000000001/88888888-8888-8888-8888-888888888888/f0000000-0000-0000-0000-000000000002-budget.pdf',
            'budget.pdf', 'application/pdf', 5000)$$,
  '42501', null, 'council member cannot upload project documents');
select lives_ok(
  $$insert into public.attachments (proposal_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('eeeeeeee-0000-0000-0000-000000000003', 'decision_document',
            'proposals/eeeeeeee-0000-0000-0000-000000000003/88888888-8888-8888-8888-888888888888/f0000000-0000-0000-0000-000000000010-memo.pdf',
            'memo.pdf', 'application/pdf', 5000)$$,
  'authorized council member can upload a decision document');

select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.attachments (project_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'budget_document',
            'projects/bbbbbbbb-0000-0000-0000-000000000001/55555555-5555-5555-5555-555555555555/f0000000-0000-0000-0000-000000000001-budget.pdf',
            'budget.pdf', 'application/pdf', 5000)$$,
  'budget officer can upload a budget document');
select throws_ok(
  $$insert into public.attachments (project_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'procurement_document',
            'projects/bbbbbbbb-0000-0000-0000-000000000001/55555555-5555-5555-5555-555555555555/f0000000-0000-0000-0000-000000000003-bid.pdf',
            'bid.pdf', 'application/pdf', 5000)$$,
  '42501', null, 'budget officer cannot upload procurement documents');

select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.attachments (report_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('cccccccc-0000-0000-0000-000000000005', 'progress_evidence',
            'reports/cccccccc-0000-0000-0000-000000000005/33333333-3333-3333-3333-333333333333/f0000000-0000-0000-0000-000000000004-photo.jpg',
            'photo.jpg', 'image/jpeg', 300000)$$,
  'contractor can upload progress evidence on their progress report');
select throws_ok(
  $$insert into public.attachments (project_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'budget_document',
            'projects/bbbbbbbb-0000-0000-0000-000000000002/33333333-3333-3333-3333-333333333333/f0000000-0000-0000-0000-000000000005-x.pdf',
            'x.pdf', 'application/pdf', 5000)$$,
  '42501', null, 'contractor cannot upload budget documents');

select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.attachments (proposal_id, purpose, storage_path, file_name, mime_type, size_bytes)
    values ('eeeeeeee-0000-0000-0000-000000000002', 'proposal_document',
            'proposals/eeeeeeee-0000-0000-0000-000000000002/66666666-6666-6666-6666-666666666666/f0000000-0000-0000-0000-000000000011-plan.pdf',
            'plan.pdf', 'application/pdf', 5000)$$,
  'planner can upload a document to their own proposal');
reset role;

select ok(exists (select 1 from public.audit_log where table_name = 'attachments' and action = 'INSERT'),
  'attachment uploads are audited');

-- -----------------------------------------------------------------------------
-- LGU admin
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set role = 'project_engineer' where id = '22222222-2222-2222-2222-222222222222'$$,
  'lgu_admin can assign a staff role');
select throws_ok(
  $$update public.profiles set role = 'super_admin' where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'lgu_admin cannot grant super_admin');
select throws_ok(
  $$update public.profiles set role = 'citizen' where id = '77777777-7777-7777-7777-777777777777'$$,
  '42501', null, 'administrators cannot change their own role');
select ok((select count(*) from public.audit_log) > 0, 'admin can read the audit log');
select ok(exists (select 1 from public.reports where id = 'cccccccc-0000-0000-0000-000000000002'),
  'lgu_admin can read every concern');
select throws_ok(
  $$delete from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  '23001', null, 'a draft project with a progress report cannot be deleted');
select lives_ok(
  $$delete from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000003'$$,
  'a draft project with only citizen concerns can be deleted');
reset role;

select results_eq(
  $$select project_id is null from public.reports where id = 'cccccccc-0000-0000-0000-000000000004'$$,
  $$values (true)$$,
  'citizen concern survives project deletion, unlinked');
select ok(exists (select 1 from public.projects where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'the draft project with a progress report still exists');

-- -----------------------------------------------------------------------------
-- Service role (trusted server-side; guard triggers must not error)
-- -----------------------------------------------------------------------------
set local role service_role;
select set_config('request.jwt.claims', '', true);

select lives_ok(
  $$update public.projects set title = 'Service role edit' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'service_role can update a guarded table');
select lives_ok(
  $$insert into public.project_assignments (project_id, user_id, assignment_role)
    values ('bbbbbbbb-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'engineer')$$,
  'service_role can insert into a stamped table');
reset role;

-- -----------------------------------------------------------------------------
-- Retention: accounts with history cannot be hard-deleted
-- -----------------------------------------------------------------------------
select throws_ok(
  $$delete from auth.users where id = '11111111-1111-1111-1111-111111111111'$$,
  '23503', null, 'deleting a user who filed reports is blocked to preserve history');

select * from finish();
rollback;
