import type { Metadata } from 'next';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { ReportRowList } from '@/components/reports/ReportRowList';
import { EmptyState } from '@/components/ui/StateViews';
import { PageHeader } from '@/components/workspace/PageHeader';
import { NoAccess, NotAvailable } from '@/components/workspace/PageStates';
import { pageAccess } from '@/lib/auth/page';
import { REPORT_HANDLER_ROLES } from '@/lib/auth/roles';
import { REPORT_LIST_COLUMNS, loadNames, toReportRow, type ReportRow } from '@/lib/reports/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Report queue | LGU Tracker', robots: { index: false } };

const FILTERS = [
  { id: 'open', label: 'Open', test: (r: ReportRow) => r.status === 'submitted' || r.status === 'acknowledged' || r.status === 'in_review' },
  { id: 'new', label: 'Not opened', test: (r: ReportRow) => r.status === 'submitted' },
  { id: 'resolved', label: 'Resolved', test: (r: ReportRow) => r.status === 'resolved' },
  { id: 'closed', label: 'Closed', test: (r: ReportRow) => r.status === 'dismissed' },
  { id: 'all', label: 'All', test: () => true },
] as const;

export default async function ReportQueuePage({ searchParams }: PageProps<'/reports'>) {
  const access = await pageAccess('/reports', REPORT_HANDLER_ROLES);
  if (access.state === 'unavailable') return <NotAvailable />;
  if (access.state === 'forbidden') return <NoAccess what="The report queue" />;

  const params = await searchParams;
  const asked = Array.isArray(params.status) ? params.status[0] : params.status;
  const filter = FILTERS.find((f) => f.id === asked) ?? FILTERS[0];

  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase
    ? await supabase.from('reports').select(REPORT_LIST_COLUMNS).order('created_at', { ascending: false }).limit(300)
    : { data: null, error: new Error('not configured') };

  const all = (data ?? []).map(toReportRow).filter((row): row is ReportRow => row !== null);
  const rows = all.filter(filter.test);
  const names = supabase ? await loadNames(supabase, rows.map((r) => r.submittedBy)) : new Map<string, string>();

  return (
    <>
      <PageHeader
        title="Report queue"
        description="Concerns people sent about projects. Open one to update its status and write back to the sender."
      />
      <nav aria-label="Filter reports" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = all.filter(f.test).length;
          const active = f.id === filter.id;
          return (
            <Link
              key={f.id}
              href={f.id === 'open' ? '/reports' : `/reports?status=${f.id}`}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink ${
                active ? 'border-ink bg-ink text-on-ink' : 'border-line-strong bg-surface text-subtle hover:bg-sunken hover:text-ink'
              }`}
            >
              {f.label}
              <span className={`tabular-nums ${active ? 'text-on-ink/70' : 'text-muted'}`}>{count}</span>
            </Link>
          );
        })}
      </nav>

      {error ? (
        <NotAvailable title="The queue did not load" description="Refresh the page. If it keeps happening, try again in a few minutes." />
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong bg-surface">
          <EmptyState
            icon={Inbox}
            suri="friendly"
            title={filter.id === 'open' ? 'No open reports' : 'No reports here'}
            description={filter.id === 'open' ? 'New reports appear here and in your inbox as soon as they are sent.' : 'Try another filter.'}
          />
        </div>
      ) : (
        <ReportRowList rows={rows} base="/reports" names={names} />
      )}
    </>
  );
}
