/**
 * Public Supabase configuration shared by the browser, server, and proxy clients.
 * Only the project URL and the publishable (anon) key belong here: both are
 * designed to be public and are safe because Row Level Security protects data.
 *
 * Never put the service-role / secret key in a NEXT_PUBLIC_ variable.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';

const rawPublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  '';

/**
 * Detects a secret key (sb_secret_...) or a legacy service_role JWT that was
 * placed in a public variable by mistake, so it is never used client-side.
 */
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) {
    return true;
  }
  const payload = key.split('.')[1];
  if (!payload) {
    return false;
  }
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json)?.role === 'service_role';
  } catch {
    return false;
  }
}

const publishableKeyIsSecret = rawPublishableKey !== '' && isSecretKey(rawPublishableKey);

if (publishableKeyIsSecret) {
  console.error(
    '[LGU Tracker] The NEXT_PUBLIC Supabase key is a secret/service-role key. ' +
      'It has been ignored. Replace it with the publishable key and rotate the secret key in Supabase.'
  );
}

export const SUPABASE_PUBLISHABLE_KEY = publishableKeyIsSecret ? '' : rawPublishableKey;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    SUPABASE_URL.startsWith('http') &&
    SUPABASE_PUBLISHABLE_KEY.length > 20
);
