'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ErrorState } from '@/components/ui/StateViews';
import { panelClass, textLinkClass } from '@/components/dpwh/ui';

/**
 * Unexpected failures inside the public project pages. The navigation and
 * footer (the layout above) stay; only the page area is replaced. Server
 * errors arrive with a generic message and a digest that matches the server
 * log, so only the digest is logged here and nothing internal is shown.
 */
export default function ProjectsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
    console.error('[LGU Tracker] Project page failed to render.', digest ? `Digest: ${digest}` : '');
  }, [error]);

  return (
    <ErrorState
      className={panelClass}
      title="This page could not be loaded"
      description="Something went wrong while loading project data. The data has not been changed. Try again, or go back to the project directory."
      onRetry={retry}
    >
      <Link href="/projects" className={`text-[13px] ${textLinkClass}`}>
        Go to the project directory
      </Link>
    </ErrorState>
  );
}
