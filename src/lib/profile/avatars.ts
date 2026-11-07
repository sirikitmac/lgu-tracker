import type { Look } from '@/lib/community/types';

/**
 * How a person shows up: a name, an optional job title, and a picture that is
 * either a photo they upload or one of the free drawn avatars below. Pure
 * helpers only (limits, ids, paths, validation), shared by the form, the
 * server action and the tests.
 */

export const AVATAR_BUCKET = 'avatars';
export const NAME_MAX = 80;
export const TITLE_MAX = 60;
/** The cropped square is stored at this size (pixels per side). */
export const AVATAR_SIZE = 384;
export const AVATAR_MAX_BYTES = 1024 * 1024;
/** What the file picker offers; a phone shows its camera and album for these. */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export interface AvatarPreset {
  id: string;
  /** Read out by screen readers and shown as a tooltip. */
  label: string;
  look: Look;
  /** Background colour index, see community/Avatar. */
  bg: number;
}

/** The free avatars. Made up faces, no real people. Keep the ids: they are saved on profiles. */
export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'p1', label: 'Short black hair, glasses', bg: 0, look: { skin: 2, hair: 'short', hairColor: 0, top: 0, glasses: true } },
  { id: 'p2', label: 'Long dark hair', bg: 1, look: { skin: 1, hair: 'long', hairColor: 1, top: 3 } },
  { id: 'p3', label: 'Hair in a bun', bg: 3, look: { skin: 2, hair: 'bun', hairColor: 0, top: 2 } },
  { id: 'p4', label: 'Curly hair', bg: 5, look: { skin: 4, hair: 'curly', hairColor: 0, top: 1 } },
  { id: 'p5', label: 'Side part, glasses', bg: 4, look: { skin: 3, hair: 'side', hairColor: 2, top: 4, glasses: true } },
  { id: 'p6', label: 'Bob cut', bg: 2, look: { skin: 1, hair: 'bob', hairColor: 0, top: 5 } },
  { id: 'p7', label: 'Cropped hair, stubble', bg: 1, look: { skin: 3, hair: 'crop', hairColor: 0, top: 0, facial: 'stubble' } },
  { id: 'p8', label: 'Wavy hair', bg: 0, look: { skin: 2, hair: 'wave', hairColor: 1, top: 1 } },
  { id: 'p9', label: 'Grey hair, moustache', bg: 3, look: { skin: 1, hair: 'side', hairColor: 3, top: 2, facial: 'mustache' } },
  { id: 'p10', label: 'Grey bun, glasses', bg: 5, look: { skin: 2, hair: 'bun', hairColor: 3, top: 4, glasses: true } },
  { id: 'p11', label: 'Curly brown hair', bg: 2, look: { skin: 3, hair: 'curly', hairColor: 2, top: 5 } },
  { id: 'p12', label: 'Short hair, moustache', bg: 4, look: { skin: 4, hair: 'short', hairColor: 0, top: 3, facial: 'mustache' } },
];

const BY_ID = new Map(AVATAR_PRESETS.map((p) => [p.id, p]));

export const presetById = (id: string | null | undefined): AvatarPreset | undefined => (id ? BY_ID.get(id) : undefined);

/** Ideas shown under the job title box. A person can still write anything. */
export const JOB_SUGGESTIONS = [
  'Student', 'Teacher', 'Engineer', 'Nurse', 'Barangay official', 'Government employee',
  'Farmer', 'Driver', 'Business owner', 'Journalist', 'Volunteer', 'Retired',
] as const;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH_PATTERN = new RegExp(`^(${UUID})/${UUID}\\.(jpg|webp)$`);

/** {account id}/{uuid}.jpg: the shape the storage policy and the profile check accept. */
export function avatarStoragePath(userId: string, uuid: string): string {
  return `${userId}/${uuid}.jpg`;
}

export function isOwnAvatarPath(path: string, userId: string): boolean {
  const m = PATH_PATTERN.exec(path);
  return Boolean(m) && m![1] === userId.toLowerCase();
}

/** The public link to an uploaded picture, or null when Supabase is not configured. */
export function avatarPublicUrl(path: string | null | undefined, baseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''): string | null {
  if (!path || !baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

/** One or two capital letters for people with no picture. */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = [...words[0]][0] ?? '?';
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';
  return (first + last).toUpperCase();
}

export interface ProfileInput {
  fullName: string;
  positionTitle: string;
  /** A photo already uploaded to the person's own folder, or null. */
  avatarPath: string | null;
  /** A free avatar id, or null. */
  avatarPreset: string | null;
}

export type ProfileCheck = { ok: true; value: ProfileInput } | { ok: false; error: string; field: 'fullName' | 'positionTitle' | 'avatar' };

/** Collapses runs of spaces and drops control characters. */
function tidy(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Checks what the form sent. Used on the server and in the form for the same messages. */
export function validateProfile(raw: unknown, userId: string): ProfileCheck {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  const fullName = tidy(str(input.fullName));
  if (fullName.length < 1) return { ok: false, field: 'fullName', error: 'Write your name.' };
  if (fullName.length > NAME_MAX) return { ok: false, field: 'fullName', error: `Your name can be up to ${NAME_MAX} characters.` };

  const positionTitle = tidy(str(input.positionTitle));
  if (positionTitle.length > TITLE_MAX) return { ok: false, field: 'positionTitle', error: `Your job can be up to ${TITLE_MAX} characters.` };

  const avatarPath = typeof input.avatarPath === 'string' && input.avatarPath ? input.avatarPath : null;
  const avatarPreset = typeof input.avatarPreset === 'string' && input.avatarPreset ? input.avatarPreset : null;
  if (avatarPath && avatarPreset) return { ok: false, field: 'avatar', error: 'Choose a photo or an avatar, not both.' };
  if (avatarPath && !isOwnAvatarPath(avatarPath, userId)) return { ok: false, field: 'avatar', error: 'That photo could not be used. Upload it again.' };
  if (avatarPreset && !presetById(avatarPreset)) return { ok: false, field: 'avatar', error: 'That avatar does not exist.' };

  return { ok: true, value: { fullName, positionTitle, avatarPath, avatarPreset } };
}
