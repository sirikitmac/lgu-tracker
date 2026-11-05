# Loading sample reports

The reports database is ready: `public.reports` (with a short number like `RPT-00042`), the timeline in
`public.report_events`, and the inbox in `public.notifications`. These steps load sample reports so you can
try My reports, the report queue and the inbox.

## 1. Apply the migrations

```bash
supabase db push
```

The new migration is `20261108000100_notifications_and_report_workflow.sql`. It also needs
`20261107000100_account_type.sql` and `20261107000200_directory_record_reports.sql` from before.

## 2. Make the accounts

Sign up the people who will "send" the reports (each needs an account, because a report belongs to
someone). Make one account a staff member to review them: in **Users and roles**, an administrator gives
a role. The first administrator is set once in Supabase (`update public.profiles set role = 'super_admin'
where id = '…'`).

## 3. Write the file

A JSON array. Every report needs a `submitter`, a `source` and `record_id` of a project that exists in
the directory, a `category`, and `details` (20 to 5000 characters). The rest is optional.

| Field | Meaning |
| --- | --- |
| `submitter` | E-mail or id of an existing account |
| `source` | `dpwh_contracts`, `dpwh_nep_2027`, `subaybayan_lgsf`, `subaybayan_rlip` |
| `record_id` | The contract id, or the record's id in that source (the "project code" people see) |
| `category` | `incorrect_information`, `not_found_on_site`, `delayed_or_stalled`, `poor_quality`, `safety_hazard`, `possible_irregularity`, `other` |
| `details` | What the person saw |
| `observed_on` | Date seen, `YYYY-MM-DD` (optional) |
| `location_note` | Where, up to 300 characters (optional) |
| `status` | `submitted` (default), `acknowledged`, `in_review`, `resolved`, `dismissed` |
| `note` | The handler's message, shown to the sender (optional) |
| `created_at` | When it was sent, a past date or date-time (optional) |

See `docs/examples/mock-reports.example.json`. The title and key fields of the project are copied from the
database for you, the same way the app does it.

## 4. Check, then import

```bash
npm run reports:import -- my-reports.json            # checks the file, the accounts and the projects
npm run reports:import -- my-reports.json --apply    # inserts them
```

`--apply` needs `SUPABASE_SECRET_KEY` (service role) in `.env.local`. The dry run stops at the first
problem and says which report it is. Imports do not send notifications; reports sent through the app do.

## Technical alerts

Scripts and jobs can tell administrators about a problem (a failed import, for example) with the
service role:

```sql
select public.create_system_alert('DPWH sync failed', 'Run 42 stopped at row 1,200.', '/dashboard');
```

It lands in the inbox of every active super administrator and LGU administrator.
