import type { HairStyle, Look, Profile } from './types';

/**
 * Sample people, used for the landing page reviews and the community
 * discussions. All names, places and stories are made up.
 */
export const PROFILES: Profile[] = [
  { id: 'maricel', name: 'Maricel Dela Cruz', place: 'Iligan City', tag: 'Barangay kagawad', tone: 0, shape: 0, look: { skin: 2, hair: 'bob', hairColor: 0, top: 0, glasses: true } },
  { id: 'junjun', name: 'Jun-jun Villanueva', place: 'Cagayan de Oro', tag: 'Civil engineering student', tone: 3, shape: 1, look: { skin: 3, hair: 'short', hairColor: 0, top: 1 } },
  { id: 'angelica', name: 'Angelica Ramos', place: 'Quezon City', tag: 'Freelance journalist', tone: 1, shape: 0, look: { skin: 1, hair: 'long', hairColor: 1, top: 3 } },
  { id: 'ramon', name: 'Engr. Ramon Sabalones', place: 'Davao City', tag: 'Government employee', tone: 4, shape: 1, look: { skin: 2, hair: 'side', hairColor: 3, top: 2, facial: 'mustache' } },
  { id: 'lorna', name: 'Lorna Baluyot', place: 'Cebu City', tag: 'Retired teacher', tone: 2, shape: 2, look: { skin: 1, hair: 'bun', hairColor: 3, top: 4, glasses: true } },
  { id: 'rahman', name: 'Rahman Macaraya', place: 'Marawi City', tag: 'Community volunteer', tone: 5, shape: 1, look: { skin: 3, hair: 'crop', hairColor: 0, top: 5, facial: 'stubble' } },
  { id: 'carlo', name: 'Carlo Mendoza', place: 'San Fernando, Pampanga', tag: 'Tricycle driver', tone: 3, shape: 2, look: { skin: 4, hair: 'curly', hairColor: 0, top: 0, facial: 'mustache' } },
  { id: 'jessa', name: 'Jessa Marie Tolentino', place: 'Batangas City', tag: 'Nurse', tone: 0, shape: 2, look: { skin: 2, hair: 'bun', hairColor: 0, top: 2 } },
  { id: 'bong', name: 'Bong Aguilar', place: 'Bacolod City', tag: 'Small business owner', tone: 4, shape: 0, look: { skin: 3, hair: 'side', hairColor: 1, top: 1, glasses: true } },
  { id: 'trisha', name: 'Trisha Ocampo', place: 'Iloilo City', tag: 'IT student', tone: 1, shape: 1, look: { skin: 2, hair: 'wave', hairColor: 0, top: 4 } },
];

const BY_ID = new Map(PROFILES.map((p) => [p.id, p]));

export const profileById = (id: string): Profile | undefined => BY_ID.get(id);

/** Picks a stable look for an account that has no sample profile (someone who posts here). */
function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** The profile to show for an author id, falling back to a plain member card with the name they posted under. */
export function resolveAuthor(id: string, name?: string): Profile {
  const known = BY_ID.get(id);
  if (known) return known;
  const h = hash(id);
  return { id, name: name?.trim() || 'Community member', place: '', tag: 'Member', tone: h % 6, shape: (h >> 3) % 3, look: lookFromSeed(id) };
}

const HAIR: HairStyle[] = ['short', 'side', 'crop', 'curly', 'long', 'wave', 'bob', 'bun'];
const SKIN_SPREAD = [1, 2, 2, 3, 3, 2, 4, 0];

/** A stable made-up face for any text, so the same account always looks the same. */
export function lookFromSeed(seed: string): Look {
  // Short ids hash to nearby numbers, so mix the bits before picking parts.
  let h = hash(seed) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  const hair = HAIR[(h >>> 3) % HAIR.length];
  const short = hair === 'short' || hair === 'side' || hair === 'crop' || hair === 'curly';
  return {
    skin: SKIN_SPREAD[h % SKIN_SPREAD.length],
    hair,
    hairColor: (h >>> 6) % 3,
    top: (h >>> 9) % 6,
    glasses: (h >>> 12) % 5 === 0,
    facial: short && (h >>> 14) % 3 === 0 ? 'stubble' : undefined,
  };
}
