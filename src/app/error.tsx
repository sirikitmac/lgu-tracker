'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ErrorState } from '@/components/ui/StateViews';
import { panelClass, textLinkClass } from '@/components/dpwh/ui';

/**
 * Last-resort boundary for pages outside /projects (landing, sign-in, the
 * LGU workspace). Logs only the server digest; shows no internal detail.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
    console.error('[LGU Tracker] Page failed to render.', digest ? `Digest: ${digest}` : '');
  }, [error]);

  return (
    <main className="flex-1 grid place-items-center px-4 py-16">
      <ErrorState
        className={`${panelClass} w-full max-w-lg`}
        title="Something went wrong"
        description="This page could not be shown. Nothing was changed. Try again, or return to the home page."
        onRetry={retry}
      >
        <Link href="/" className={`text-[13px] ${textLinkClass}`}>
          Go to the home page
        </Link>
      </ErrorState>
    </main>
  );
}
