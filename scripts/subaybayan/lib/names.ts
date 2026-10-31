/**
 * Place-name normalization for matching SubayBAYAN location labels to PSGC
 * boundary names. Both sides go through the same function, so the rules
 * only need to make equal names equal, not produce pretty output.
 */

const WORD_MAP: Record<string, string> = {
  pob: 'poblacion',
  sto: 'santo',
  sta: 'santa',
  gen: 'general',
};
const DROP_WORDS = new Set(['barangay', 'brgy', 'bgy']);

export function normalizePlaceName(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents: ñ → n, é → e
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // "(Capital)", "(Not a Province)", "(North Cotabato)"
    .replace(/[^a-z0-9]+/g, ' ') // punctuation, hyphens, apostrophes, dots
    .trim();
  s = s.replace(/^city of /, '').replace(/ city$/, '');
  if (s === 'city') return '';
  return s
    .split(' ')
    .filter((w) => w && !DROP_WORDS.has(w))
    .map((w) => WORD_MAP[w] ?? w)
    .join(' ');
}

/**
 * Splits a barangay cell that may list several barangays. Returns one item
 * when the cell names a single place. Commas inside a single name
 * ("Sixto Velez, Sr.", "Quezon, Jr.") are the caller's concern: it should
 * try the whole cell as one name first.
 */
export function splitPlaceList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\s*(?:,|;|\/|&|\band\b|\n)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}
