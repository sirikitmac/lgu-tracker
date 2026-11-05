-- The people-facing roles are now Super Admin, Admin, Government Employee and
-- Citizen. The enum keeps its values (they are what the access rules are
-- written against); only the names shown in notifications change. Every staff
-- role other than the two admins reads as "Government Employee".
create or replace function private.role_label(r public.app_role)
returns text
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'super_admin' then 'Super Admin'
    when 'lgu_admin'   then 'Admin'
    when 'citizen'     then 'Citizen'
    else 'Government Employee'
  end;
$$;
