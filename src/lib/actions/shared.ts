import { AuthorizationError } from '@/lib/auth/authorize';

/**
 * Helpers shared by the Server Action modules. Kept out of the 'use server'
 * files because those may only export async functions.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AuthorizationError) {
    return { ok: false, error: error.message };
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '42501') {
    return { ok: false, error: 'You do not have permission to make this change.' };
  }
  console.error('[LGU Tracker] Server action failed:', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}
