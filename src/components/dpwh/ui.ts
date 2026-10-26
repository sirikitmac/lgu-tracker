/**
 * Shared surface and control classes for the public project screens, so
 * cards, filters, the table, and the grid use one border, radius, and control
 * height. Values come from the design tokens in globals.css (ink, ground,
 * line, accent); nothing here hard-codes a colour.
 *
 * Each helper is a base plus one size. Combine a base with a size string;
 * never append a second height or padding to a finished class, because two
 * utilities for one property resolve by stylesheet order, not by the order
 * they are written in.
 */

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** White panel on the page ground: one hairline edge, no shadow at rest. */
export const panelClass = 'bg-surface border border-line rounded-card';

/** Floating glass layer (sticky toolbars, overlays). Never for data panels. */
export const glassBarClass = 'glass border border-line/70';

/** Inputs and selects without size: add one of the sizes below. */
export const controlBaseClass =
  'border border-line-strong bg-surface text-ink placeholder:text-muted transition-colors hover:border-muted/50 focus:outline-2 focus:outline-offset-0 focus:outline-accent-ink disabled:bg-ground disabled:text-muted disabled:cursor-not-allowed disabled:hover:border-line-strong';

/** Standard 40px field, full width. */
export const controlClass = `${controlBaseClass} w-full h-10 px-3 rounded-control text-sm`;

const buttonBase = `inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors active:scale-[0.98] ${focusRing}`;
const secondaryBase = `${buttonBase} border border-line-strong bg-surface text-ink hover:bg-sunken disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface disabled:active:scale-100`;

/** The one filled action on a screen, in the theme's ink (near-black, or near-white in dark mode). */
export const primaryButtonClass = `${buttonBase} h-10 px-4 text-sm bg-ink text-on-ink hover:bg-ink-soft`;

/** Signal-orange action with ink text (landing page call-to-action style). */
export const accentButtonClass = `${buttonBase} h-10 px-4 text-sm bg-accent text-ink hover:bg-signal-tint`;

/** White, bordered secondary action, 40px. */
export const secondaryButtonClass = `${secondaryBase} h-10 px-4 text-sm`;
/** Compact secondary action, 36px. */
export const secondaryButtonSmClass = `${secondaryBase} h-9 px-3 text-[13px]`;
/** Tall secondary action beside the 48px search field. */
export const secondaryButtonLgClass = `${secondaryBase} h-12 px-4 text-sm`;
/** Square icon-only secondary action, 36px; give it an aria-label. */
export const iconButtonClass = `${secondaryBase} h-9 w-9 shrink-0`;

/** Ink text link with an underline on hover; accent only on focus. */
export const textLinkClass = `text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink rounded-sm ${focusRing}`;
