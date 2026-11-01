'use client';

import { BP_OPEN_EVENT, type BpOpenDetail } from '@/components/bp/BpAssistant';

/**
 * The "Ask BP" card of "Six ways in": a button, since it opens a panel rather
 * than going anywhere. It asks the navigation's BP to open (BP_OPEN_EVENT),
 * which hands the focus back to this card when the panel closes.
 */
export function BpCardButton({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={className}
      onClick={(e) => {
        window.dispatchEvent(new CustomEvent<BpOpenDetail>(BP_OPEN_EVENT, { detail: { from: e.currentTarget } }));
      }}
    >
      {children}
    </button>
  );
}
