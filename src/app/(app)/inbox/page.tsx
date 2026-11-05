import type { Metadata } from 'next';
import { InboxList } from '@/components/notifications/InboxList';
import { PageHeader } from '@/components/workspace/PageHeader';
import { NotAvailable } from '@/components/workspace/PageStates';
import { pageAccess } from '@/lib/auth/page';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isNotificationKind, type AppNotification } from '@/types/notification';

export const metadata: Metadata = { title: 'Inbox | LGU Tracker', robots: { index: false } };

export default async function InboxPage() {
  const access = await pageAccess('/inbox');
  if (access.state !== 'ok') return <NotAvailable />;

  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase
    ? await supabase
        .from('notifications')
        .select('id, kind, title, body, link, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: null, error: new Error('not configured') };

  const items: AppNotification[] = (data ?? [])
    .filter((row) => isNotificationKind(row.kind))
    .map((row) => ({
      id: row.id as string,
      kind: row.kind,
      title: row.title as string,
      body: (row.body as string | null) ?? null,
      link: (row.link as string | null) ?? null,
      readAt: (row.read_at as string | null) ?? null,
      createdAt: row.created_at as string,
    }));

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Updates on the reports you send, changes to your role, and anything that needs your attention."
      />
      {error ? (
        <NotAvailable title="Your inbox did not load" description="Refresh the page. If it keeps happening, try again in a few minutes." />
      ) : (
        <InboxList initial={items} />
      )}
    </>
  );
}
