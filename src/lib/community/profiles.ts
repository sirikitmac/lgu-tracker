import type { Profile } from './types';

/**
 * Sample people, used for the landing page reviews and the community
 * discussions. All names, places and stories are made up.
 */
export const PROFILES: Profile[] = [
  { id: 'maricel', name: 'Maricel Dela Cruz', place: 'Iligan City', tag: 'Barangay kagawad', tone: 0, shape: 0 },
  { id: 'junjun', name: 'Jun-jun Villanueva', place: 'Cagayan de Oro', tag: 'Civil engineering student', tone: 3, shape: 1 },
  { id: 'angelica', name: 'Angelica Ramos', place: 'Quezon City', tag: 'Freelance journalist', tone: 1, shape: 0 },
  { id: 'ramon', name: 'Engr. Ramon Sabalones', place: 'Davao City', tag: 'Government employee', tone: 4, shape: 1 },
  { id: 'lorna', name: 'Lorna Baluyot', place: 'Cebu City', tag: 'Retired teacher', tone: 2, shape: 2 },
  { id: 'rahman', name: 'Rahman Macaraya', place: 'Marawi City', tag: 'Community volunteer', tone: 5, shape: 1 },
  { id: 'carlo', name: 'Carlo Mendoza', place: 'San Fernando, Pampanga', tag: 'Tricycle driver', tone: 3, shape: 2 },
  { id: 'jessa', name: 'Jessa Marie Tolentino', place: 'Batangas City', tag: 'Nurse', tone: 0, shape: 2 },
  { id: 'bong', name: 'Bong Aguilar', place: 'Bacolod City', tag: 'Small business owner', tone: 4, shape: 0 },
  { id: 'trisha', name: 'Trisha Ocampo', place: 'Iloilo City', tag: 'IT student', tone: 1, shape: 1 },
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
  return { id, name: name?.trim() || 'Community member', place: '', tag: 'Member', tone: h % 6, shape: (h >> 3) % 3 };
}
