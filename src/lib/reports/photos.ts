/**
 * Photos on a citizen concern. Pure helpers (limits, file names, storage paths)
 * plus the browser-only step that shrinks and re-encodes a picture.
 *
 * Re-encoding through a canvas drops everything stored inside the original
 * file (EXIF: GPS position, device model, time), so a reporter never leaks
 * their home location by attaching a photo.
 */

export const PHOTO_BUCKET = 'report-photos';
export const PHOTO_MAX_COUNT = 4;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

/** A file name that is safe inside a storage path. */
export function safePhotoName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${(base || 'photo').slice(0, 60)}.jpg`;
}

/** reports/{report id}/{account id}/{uuid}-{name}: the shape the storage policy accepts. */
export function photoStoragePath(reportId: string, userId: string, uuid: string, fileName: string): string {
  return `reports/${reportId}/${userId}/${uuid}-${safePhotoName(fileName)}`;
}

/** Scales (width, height) down so the longer side is at most `max`. Never scales up. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export function isImageFile(file: { type: string; name: string }): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

/** Decodes, shrinks and re-encodes as JPEG. Throws a readable Error when the browser cannot read the picture. */
export async function prepareReportPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This picture could not be read. Try a JPEG or PNG, or take a new photo.');
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot prepare pictures.');
    ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black in JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    for (const quality of [0.82, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= PHOTO_MAX_BYTES) return blob;
    }
    throw new Error('This picture is too large even after shrinking it.');
  } finally {
    bitmap.close();
  }
}
