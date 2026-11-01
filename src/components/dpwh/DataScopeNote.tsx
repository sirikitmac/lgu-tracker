import React from 'react';
import Link from 'next/link';
import { ChevronDown, Info } from 'lucide-react';
import { PROJECT_SOURCES } from '@/lib/integrations/bettergov/sources';
import { SUBAYBAYAN_RETRIEVED_LABEL } from '@/lib/subaybayan/source';

/**
 * The full data disclosure of a public data screen (sources, coverage,
 * not verified by the LGU), as one short line that opens into the detail.
 * Import completeness and dates live in DataFreshness, beside the figures.
 * Native <details>, so it works without script and from the keyboard.
 */
export function DataScopeNote({ className = '' }: { className?: string }) {
  return (
    <details className={`group rounded-card bg-sunken text-[13px] leading-relaxed text-ink ${className}`}>
      <summary className="flex items-center gap-2.5 min-h-11 px-4 py-2.5 cursor-pointer list-none rounded-card [&::-webkit-details-marker]:hidden hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink">
        <Info className="w-4 h-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="font-semibold">About this data:</span> <span className="text-subtle">as published by each source, not verified by the LGU.</span>
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-4 pb-4 pt-1 sm:pl-[2.625rem] grid gap-x-8 gap-y-3 sm:grid-cols-2 text-subtle">
        <div>
          <p className="font-semibold text-ink">{PROJECT_SOURCES.dpwh_contracts.label}</p>
          <p>
            Visayas and Mindanao contracts from the DPWH Transparency Portal, via BetterGov.ph (CC0). Placed by the reported
            project location, not the implementing office.
          </p>
        </div>
        <div>
          <p className="font-semibold text-ink">FY 2027 NEP proposals</p>
          <p>Budget items, nationwide, not contracts. Never in contract totals, and not on the map (no coordinates).</p>
        </div>
        <div className="sm:col-span-2">
          <p className="font-semibold text-ink">DILG SubayBAYAN LGU projects</p>
          <p>
            Locally Funded and LIME 20% DF projects, nationwide; a one-time export retrieved {SUBAYBAYAN_RETRIEVED_LABEL}. Placed at
            the centre of their barangay, town or province, not the site. Categories are LGU Tracker&apos;s own. Extreme totals are
            marked &ldquo;Amount not verified&rdquo;. DPWH and DILG records are never merged.
          </p>
        </div>
        <p className="sm:col-span-2 text-xs">
          <Link href="/credits" className="underline underline-offset-2 rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink">
            Licenses and credits
          </Link>
        </p>
      </div>
    </details>
  );
}
