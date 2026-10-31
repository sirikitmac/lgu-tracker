import React from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import type { CostBasis } from '@/lib/subaybayan/query';
import { formatPeso } from '@/components/dpwh/format';

/** The source reported a different total; say so and show what it said. */
export function CostNote({ reported, basis }: { reported: number; basis: CostBasis }) {
  const used = basis === 'contract_amount' ? 'contract amount' : 'subsidy amount (national subsidy + LGU counterpart)';
  return (
    <span role="note" className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-warn-line bg-warn-soft px-2.5 py-2 text-[12px] leading-snug text-warn-ink">
      <Info className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
      <span>
        Reported total looked like a data-entry error; showing the {used} instead. SubayBAYAN reports{' '}
        <strong className="font-semibold tabular-nums">{formatPeso(reported)}</strong>.
      </span>
    </span>
  );
}

/** The total is extreme for its kind of project (scripts/subaybayan/lib/review.ts) and has not been verified. */
export function ReviewNote() {
  return (
    <span role="note" className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-warn-line bg-warn-soft px-2.5 py-2 text-[12px] leading-snug text-warn-ink">
      <TriangleAlert className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Amount not verified.</strong> This total is at least ₱100 million and 100 times the typical total for
        this kind of project, which often means a data-entry error. It is shown as reported, not corrected, and listed after verified amounts.
        Check the SubayBAYAN portal before relying on it.
      </span>
    </span>
  );
}
