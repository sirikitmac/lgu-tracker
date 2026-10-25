/**
 * Hugging Face Hub helpers for BetterGov.ph datasets (documented Hub API,
 * public files only).
 */

const HUB = 'https://huggingface.co';

export interface HubSnapshot {
  dataset: string;
  file: string;
  /** Commit that last changed the file; the snapshot's identity. */
  revision: string;
  /** When that commit was made. */
  committedAt: string;
  fileUrl: string;
  sizeBytes: number | null;
}

export class HubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HubError';
  }
}

export function hubFileUrl(dataset: string, file: string, revision: string): string {
  return `${HUB}/datasets/${dataset}/resolve/${revision}/${file}`;
}

/** Asks the Hub which commit last changed `file` on main. */
export async function resolveHubSnapshot(dataset: string, file: string, fetchImpl: typeof fetch = fetch): Promise<HubSnapshot> {
  let response: Response;
  try {
    response = await fetchImpl(`${HUB}/api/datasets/${dataset}/paths-info/main`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [file], expand: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new HubError(`Hugging Face Hub unreachable: ${(error as Error).message}`);
  }
  if (!response.ok) throw new HubError(`Hugging Face Hub returned HTTP ${response.status}.`);
  const body = (await response.json().catch(() => null)) as
    | { path?: string; size?: number; lastCommit?: { id?: string; date?: string } }[]
    | null;
  const entry = Array.isArray(body) ? body.find((e) => e?.path === file) : undefined;
  const revision = entry?.lastCommit?.id;
  const date = entry?.lastCommit?.date;
  if (!entry || typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision) || typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
    throw new HubError(`Hub response did not describe ${dataset}/${file}.`);
  }
  return {
    dataset,
    file,
    revision,
    committedAt: new Date(date).toISOString(),
    fileUrl: hubFileUrl(dataset, file, revision),
    sizeBytes: typeof entry.size === 'number' ? entry.size : null,
  };
}

/** Downloads a text file at an exact revision; refuses a truncated body. */
export async function downloadHubText(snapshot: HubSnapshot, fetchImpl: typeof fetch = fetch): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(snapshot.fileUrl, { cache: 'no-store', signal: AbortSignal.timeout(120_000) });
  } catch (error) {
    throw new HubError(`Could not download ${snapshot.file}: ${(error as Error).message}`);
  }
  if (!response.ok) throw new HubError(`Downloading ${snapshot.file} returned HTTP ${response.status}.`);
  const body = new Uint8Array(await response.arrayBuffer());
  if (snapshot.sizeBytes !== null && body.byteLength !== snapshot.sizeBytes) {
    throw new HubError(`Downloaded ${body.byteLength} bytes of ${snapshot.file}; the Hub reports ${snapshot.sizeBytes}.`);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(body);
}
