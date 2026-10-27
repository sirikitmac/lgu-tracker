/**
 * Browser-side JSON requests with error messages that are safe to show.
 *
 * The app's own API routes already answer failures with short, written-for-
 * people `{ error }` strings (database details stay in the server log), so
 * those are passed through. Everything else (no connection, an HTML error
 * page, a malformed body) becomes a plain sentence instead of a raw
 * exception message such as "Failed to fetch" or "Unexpected token <".
 */

export class RequestError extends Error {
  /** HTTP status, or null when the server was never reached. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }

  /** True when no response arrived at all (offline, DNS, connection reset). */
  get isNetworkError(): boolean {
    return this.status === null;
  }
}

const OFFLINE_MESSAGE = 'Could not reach LGU Tracker. Check your internet connection and try again.';
const UNREADABLE_MESSAGE = 'The server sent a response that could not be read. Please try again.';

function statusMessage(status: number): string {
  if (status === 404) return 'The requested record was not found.';
  if (status === 429) return 'Too many requests right now. Wait a moment and try again.';
  if (status >= 500) return 'The server could not complete the request. Please try again in a moment.';
  return 'The request could not be completed.';
}

/** Logs the endpoint path and status only: never the query string, body, or headers. */
function logFailure(url: string, status: number | null) {
  const path = url.split('?')[0];
  console.warn('[LGU Tracker] Request failed:', path, status ?? 'network');
}

/**
 * fetch() + JSON with consistent failures: rejects with a RequestError whose
 * message can go straight into the interface. Aborts are rethrown unchanged
 * so callers can keep ignoring superseded requests.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    logFailure(url, null);
    throw new RequestError(OFFLINE_MESSAGE, null);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    logFailure(url, res.status);
    throw new RequestError(res.ok ? UNREADABLE_MESSAGE : statusMessage(res.status), res.status);
  }

  if (!res.ok) {
    logFailure(url, res.status);
    const message = (body as { error?: unknown } | null)?.error;
    throw new RequestError(typeof message === 'string' && message ? message : statusMessage(res.status), res.status);
  }
  return body as T;
}

/** A sentence for any thrown value: RequestError messages as written, anything else generic. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return error instanceof RequestError ? error.message : fallback;
}
