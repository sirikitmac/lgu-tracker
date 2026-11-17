import type { AppRole } from '@/types/auth';

/**
 * Role pills. Three kinds have a pill whose label and colour an administrator
 * can change; citizens and contractors have none. An administrator can also
 * give themselves a custom pill, which replaces the kind's default on their own
 * name. Mirrors private.badge_tier and the custom-badge rules in migration
 * 20261118000100 (the database is what enforces them).
 */
export type BadgeTier = 'super_admin' | 'admin' | 'employee';

export interface BadgeStyle {
  label: string;
  color: string;
}

export type BadgeStyles = Record<BadgeTier, BadgeStyle>;

export const BADGE_TIERS: readonly BadgeTier[] = ['super_admin', 'admin', 'employee'];

/** Purple, red and green until an administrator changes them. */
export const DEFAULT_BADGE_STYLES: BadgeStyles = {
  super_admin: { label: 'Super Admin', color: '#7C3AED' },
  admin: { label: 'Admin', color: '#DC2626' },
  employee: { label: 'LGU', color: '#16A34A' },
};

export const BADGE_TIER_NAME: Record<BadgeTier, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  employee: 'Government Employee',
};

export const BADGE_LABEL_MAX = 24;
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Colours offered as one-tap choices; any six-digit hex also works. */
export const BADGE_SWATCHES: readonly string[] = [
  '#7C3AED', '#DC2626', '#16A34A', '#2563EB', '#0EA5E9', '#F59E0B', '#EC4899', '#0F766E', '#475569', '#111827',
];

export const isBadgeTier = (v: unknown): v is BadgeTier => v === 'super_admin' || v === 'admin' || v === 'employee';
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

/** Which pill a role gets by default; null for citizens and contractors. */
export function badgeTierOf(role: AppRole): BadgeTier | null {
  switch (role) {
    case 'super_admin':
      return 'super_admin';
    case 'lgu_admin':
      return 'admin';
    case 'citizen':
    case 'contractor':
      return null;
    default:
      return 'employee';
  }
}

/** The rows of public.role_badge_styles to a complete set, falling back to the defaults for anything missing or malformed. */
export function stylesFromRows(rows: unknown): BadgeStyles {
  const out: BadgeStyles = {
    super_admin: { ...DEFAULT_BADGE_STYLES.super_admin },
    admin: { ...DEFAULT_BADGE_STYLES.admin },
    employee: { ...DEFAULT_BADGE_STYLES.employee },
  };
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (typeof r !== 'object' || r === null) continue;
    const { tier, label, color } = r as Record<string, unknown>;
    if (!isBadgeTier(tier) || typeof label !== 'string' || !label.trim() || !isHexColor(color)) continue;
    out[tier] = { label: label.trim().slice(0, BADGE_LABEL_MAX), color: color.toUpperCase() };
  }
  return out;
}

export interface BadgeInput {
  tier: BadgeTier | null;
  /** A custom pill, only meaningful together with a colour. */
  customLabel?: string | null;
  customColor?: string | null;
}

/** What to draw: the custom pill when there is one, otherwise the kind's current style; null for no pill. */
export function resolveBadge(input: BadgeInput, styles: BadgeStyles): BadgeStyle | null {
  if (!input.tier) return null;
  const label = input.customLabel?.trim();
  if (label && isHexColor(input.customColor)) return { label: label.slice(0, BADGE_LABEL_MAX), color: input.customColor };
  return styles[input.tier];
}

/** Black or white text, whichever reads better on this colour (WCAG relative luminance). */
export function readableTextColor(hex: string): '#FFFFFF' | '#111827' {
  if (!isHexColor(hex)) return '#FFFFFF';
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  // Pick the text with the higher contrast ratio.
  const white = 1.05 / (lum + 0.05);
  const dark = (lum + 0.05) / (0.0105 + 0.05);
  return white >= dark ? '#FFFFFF' : '#111827';
}

export type BadgeProblem = { field: 'label' | 'color'; message: string };

/** Checks a label and colour typed by an administrator; returns the cleaned pair or the first problem. */
export function validateBadge(label: unknown, color: unknown): { ok: true; label: string; color: string } | { ok: false; problem: BadgeProblem } {
  const text = typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : '';
  if (!text) return { ok: false, problem: { field: 'label', message: 'Give the pill a name.' } };
  if (text.length > BADGE_LABEL_MAX) return { ok: false, problem: { field: 'label', message: `Keep it to ${BADGE_LABEL_MAX} characters or fewer.` } };
  if (!isHexColor(color)) return { ok: false, problem: { field: 'color', message: 'Pick a colour, or type it like #7C3AED.' } };
  return { ok: true, label: text, color: color.toUpperCase() };
}
