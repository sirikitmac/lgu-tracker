import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { PHOTO_BUCKET, photoStoragePath } from '@/lib/reports/photos';

export interface PickedPhoto {
  key: string;
  name: string;
  blob: Blob;
  /** Object URL for the thumbnail. */
  preview: string;
  status: 'ready' | 'uploading' | 'done' | 'failed';
  error?: string;
}

/**
 * Sends prepared photos for a report that was just saved. Each photo goes
 * straight to private Storage with the reporter's own session, then gets its
 * attachments row; the database policies decide whether it is allowed.
 * One failed photo never loses the others or the report itself.
 */
export async function uploadReportPhotos(
  reportId: string,
  photos: PickedPhoto[],
  onUpdate: (key: string, patch: Partial<PickedPhoto>) => void,
): Promise<{ failed: number }> {
  const client = getSupabaseBrowserClient();
  const { data } = (await client?.auth.getUser()) ?? { data: { user: null } };
  const userId = data.user?.id;
  let failed = 0;

  for (const photo of photos) {
    if (photo.status === 'done') continue;
    if (!client || !userId) {
      onUpdate(photo.key, { status: 'failed', error: 'You are signed out. Sign in again to add photos.' });
      failed += 1;
      continue;
    }
    onUpdate(photo.key, { status: 'uploading', error: undefined });
    const path = photoStoragePath(reportId, userId, crypto.randomUUID(), photo.name);
    try {
      const up = await client.storage.from(PHOTO_BUCKET).upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false });
      if (up.error) throw up.error;
      const row = await client.from('attachments').insert({
        report_id: reportId,
        purpose: 'concern_evidence',
        storage_path: path,
        file_name: photo.name,
        mime_type: 'image/jpeg',
        size_bytes: photo.blob.size,
      });
      if (row.error) {
        await client.storage.from(PHOTO_BUCKET).remove([path]); // do not leave an orphan file behind
        throw row.error;
      }
      onUpdate(photo.key, { status: 'done' });
    } catch {
      failed += 1;
      onUpdate(photo.key, { status: 'failed', error: 'Could not upload this photo.' });
    }
  }
  return { failed };
}
