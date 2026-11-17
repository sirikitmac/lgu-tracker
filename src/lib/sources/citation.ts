/**
 * The "where this record came from" line at the top of a project page. Built
 * only from what the record itself carries: a missing field is left out, never
 * guessed.
 */

export interface CitationInput {
  /** The dataset name, e.g. "DPWH nationwide contracts dataset". Without it there is no citation. */
  dataset: string | null | undefined;
  /** Who republished the dataset, when not the agency itself. */
  publisher?: string | null;
  /** When this app last synced the dataset. */
  syncedAt?: string | null;
  /** The source snapshot in which this record's values last changed. */
  snapshotAt?: string | null;
  /** When a one-time export was retrieved. */
  retrievedAt?: string | null;
  /** The record or dataset on the source's own site. */
  sourceUrl?: string | null;
  sourceLabel?: string | null;
}

export interface Citation {
  /** One or two plain sentences, for reading and copying. */
  text: string;
  /** Present only when the record has an http(s) link. */
  link: { href: string; label: string } | null;
}

/** "Nov 7, 2026" in Philippine time, or null for a missing or unreadable date. */
export function citationDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildCitation(input: CitationInput): Citation | null {
  const dataset = input.dataset?.trim();
  if (!dataset) return null;

  const publisher = input.publisher?.trim();
  const sentences = [`From the ${dataset}${publisher ? `, published by ${publisher}` : ''}.`];

  const retrieved = citationDate(input.retrievedAt);
  const snapshot = citationDate(input.snapshotAt);
  const synced = citationDate(input.syncedAt);
  const dates = [
    retrieved && `retrieved ${retrieved}`,
    snapshot && `values as of the ${snapshot} snapshot`,
    synced && `last synced ${synced}`,
  ].filter((d): d is string => Boolean(d));
  if (dates.length > 0) sentences.push(`${capitalize(dates.join('; '))}.`);

  const href = safeUrl(input.sourceUrl);
  const link = href ? { href, label: input.sourceLabel?.trim() || 'View at the source' } : null;

  return { text: sentences.join(' '), link };
}

/** A DPWH contract, from the BetterGov.ph republication of the DPWH Transparency Portal. */
export function dpwhCitation(
  contract: { source_snapshot_at?: string | null; bettergov_record_url?: string | null },
  lastSuccessfulSyncAt: string | null,
): Citation | null {
  return buildCitation({
    dataset: 'DPWH nationwide contracts dataset (DPWH Transparency Portal)',
    publisher: 'BetterGov.ph',
    snapshotAt: contract.source_snapshot_at,
    syncedAt: lastSuccessfulSyncAt,
    sourceUrl: contract.bettergov_record_url,
    sourceLabel: 'Open this record on BetterGov.ph',
  });
}

/** A DILG SubayBAYAN project, from the one-time portal export. */
export function subaybayanCitation(
  project: { source_agency?: string | null; retrieved_at?: string | null; source_url?: string | null },
  datasetLabel: string | null,
): Citation | null {
  const agency = project.source_agency?.trim();
  if (!agency) return null;
  return buildCitation({
    dataset: `${agency} SubayBAYAN dataset${datasetLabel ? ` (${datasetLabel})` : ''}`,
    retrievedAt: project.retrieved_at,
    sourceUrl: project.source_url,
    sourceLabel: 'SubayBAYAN portal (sign-in required)',
  });
}
