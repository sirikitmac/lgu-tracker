/**
 * Where to send someone after they sign in. The login page accepts `?next=/some/path`
 * so a visitor who was asked to sign in (for example to report a project) returns
 * to where they were. The value comes from the URL, so it is untrusted: only
 * same-site paths are allowed, which prevents an "open redirect" to another site.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || raw.length > 2000) return fallback;
  // Must be a path on this site: starts with a single slash, no backslashes or control characters.
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, 'http://localhost');
  } catch {
    return fallback;
  }
  if (url.origin !== 'http://localhost') return fallback;
  // Sending someone back to the sign-in or sign-up page would just loop.
  if (url.pathname === '/login' || url.pathname === '/register') return fallback;

  return url.pathname + url.search + url.hash;
}
