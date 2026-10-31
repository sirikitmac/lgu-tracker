import type { DpwhCategory } from '@/types/dpwh';
import { isDilgSource } from '@/lib/integrations/bettergov/sources';
import { dilgPhotoCategory } from '@/lib/subaybayan/ui';
import { CATEGORY_PHOTO_POOLS, type CategoryPhoto } from './categoryPhotoCatalog';

/**
 * Pictures for project cards.
 *
 * The source data holds no project photographs: DPWH reports only how many
 * site photos it has (total_images), with no image URLs, so no card can show
 * a verified photo of its own project. Cards therefore show either:
 *
 * - a representative photo: an openly licensed picture of the same kind of
 *   work (a road for a road contract), always labelled as such and credited;
 *   it never shows the contract itself, its location, or its progress; or
 * - a placeholder: a plain tile for the category, used when the category has
 *   no pictures or none is left that is not already on the page.
 *
 * Assignment is deterministic. Each record hashes its stable key
 * (source:record_id) to a preferred photo in its category's pool. When two
 * records on the same page want the same photo, the collision is resolved in
 * hash order, never display order, so re-sorting a page never reshuffles its
 * pictures. A photo is never shown twice on one page: once a category's pool
 * is used up, the remaining records get the placeholder instead of a repeat.
 */

export type { CategoryPhoto } from './categoryPhotoCatalog';

export type CardImage =
  | { kind: 'representative'; photo: CategoryPhoto }
  | { kind: 'placeholder'; reason: 'no-pool' | 'pool-used' };

export interface ImageSubject {
  source: string;
  record_id: string;
  category: string | null;
}

export const recordKey = (r: Pick<ImageSubject, 'source' | 'record_id'>) => `${r.source}:${r.record_id}`;

/**
 * Which photo pool a directory row draws from. DPWH rows use their category.
 * DILG SubayBAYAN rows use a pool only when its pictures show the same kind
 * of work (see dilgPhotoCategory); otherwise null, so the card shows its
 * illustrated header rather than an unrelated infrastructure photo.
 */
export function cardPhotoCategory(item: { source: string; category: string | null; title: string; sector_subcategory?: string | null }): string | null {
  return isDilgSource(item.source) ? dilgPhotoCategory(item.sector_subcategory ?? null, item.title) : item.category;
}

/** Subjects for assignCardImages from directory rows. */
export const photoSubjects = (items: readonly { source: string; record_id: string; category: string | null; title: string; sector_subcategory?: string | null }[]): ImageSubject[] =>
  items.map((i) => ({ source: i.source, record_id: i.record_id, category: cardPhotoCategory(i) }));

/** 32-bit FNV-1a: small, fast, and stable across browsers and builds. */
export function hashKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function categoryPool(category: string | null): readonly CategoryPhoto[] {
  return (category && CATEGORY_PHOTO_POOLS[category as DpwhCategory]) || [];
}

/**
 * Pictures for one visible result set, keyed by recordKey. Pure: the same set
 * of records always gets the same pictures, whatever order they are passed in.
 */
export function assignCardImages(records: readonly ImageSubject[]): Map<string, CardImage> {
  const ordered = records
    .map((r) => ({ r, key: recordKey(r), hash: hashKey(recordKey(r)) }))
    .sort((a, b) => a.hash - b.hash || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const used = new Map<string, Set<number>>();
  const out = new Map<string, CardImage>();

  for (const { r, key, hash } of ordered) {
    if (out.has(key)) continue; // the same record twice in a page: keep its first picture
    const pool = categoryPool(r.category);
    if (pool.length === 0) {
      out.set(key, { kind: 'placeholder', reason: 'no-pool' });
      continue;
    }
    const taken = used.get(r.category as string) ?? new Set<number>();
    used.set(r.category as string, taken);
    const start = hash % pool.length;
    let picked = -1;
    for (let step = 0; step < pool.length; step++) {
      const i = (start + step) % pool.length;
      if (!taken.has(i)) {
        picked = i;
        break;
      }
    }
    if (picked === -1) {
      out.set(key, { kind: 'placeholder', reason: 'pool-used' });
    } else {
      taken.add(picked);
      out.set(key, { kind: 'representative', photo: pool[picked] });
    }
  }
  return out;
}

/** Distinct photos in an assignment, in pool order per category, for a credits list of what is on screen. */
export function creditsFor(assignment: Map<string, CardImage>): CategoryPhoto[] {
  const seen = new Set<string>();
  const photos: CategoryPhoto[] = [];
  for (const image of assignment.values()) {
    if (image.kind === 'representative' && !seen.has(image.photo.src)) {
      seen.add(image.photo.src);
      photos.push(image.photo);
    }
  }
  return photos.sort((a, b) => a.category.localeCompare(b.category) || a.src.localeCompare(b.src));
}
