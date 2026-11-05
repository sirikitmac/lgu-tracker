import React from 'react';
import Link from 'next/link';
import { CloudOff, LockKeyhole } from 'lucide-react';
import { EmptyState } from '@/components/ui/StateViews';

const frame = 'rounded-3xl border border-dashed border-line-strong bg-surface';

export function NotAvailable({
  title = 'This page is not available right now',
  description = 'Accounts are not set up in this environment.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className={frame}>
      <EmptyState icon={CloudOff} title={title} description={description} />
    </div>
  );
}

/** Shown to a signed-in person whose role does not include this page. */
export function NoAccess({ what }: { what: string }) {
  return (
    <div className={frame}>
      <EmptyState
        icon={LockKeyhole}
        title={`${what} is not part of your role`}
        description="Your account can browse every project and send reports. An LGU Administrator can change your role."
        action={
          <Link
            href="/inbox"
            className="inline-flex min-h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-on-ink transition-colors hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
          >
            Back to inbox
          </Link>
        }
      />
    </div>
  );
}
