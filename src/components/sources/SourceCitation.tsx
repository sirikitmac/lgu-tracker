import { ArrowUpRight, Database } from 'lucide-react';
import type { Citation } from '@/lib/sources/citation';

/**
 * A quiet "Source:" line for the top of a project page. Renders nothing when
 * the record names no dataset.
 */
export function SourceCitation({ citation, className = '' }: { citation: Citation | null; className?: string }) {
  if (!citation) return null;
  return (
    <p className={`flex items-start gap-2 text-xs leading-relaxed text-muted ${className}`}>
      <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="font-semibold text-subtle">Source: </span>
        {citation.text}
        {citation.link && (
          <>
            {' '}
            <a
              href={citation.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-accent-ink underline-offset-2 hover:underline rounded-sm focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              {citation.link.label}
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </>
        )}
      </span>
    </p>
  );
}
