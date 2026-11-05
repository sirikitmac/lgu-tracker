'use client';

import React, { useId, useRef, useState } from 'react';
import { Camera, Images, Loader2, RotateCcw, X } from 'lucide-react';
import { secondaryButtonClass } from '@/components/dpwh/ui';
import { PHOTO_ACCEPT, PHOTO_MAX_COUNT, isImageFile, prepareReportPhoto } from '@/lib/reports/photos';
import type { PickedPhoto } from '@/lib/reports/uploadPhotos';

/**
 * "Take a photo" opens the camera on a phone (capture=environment); "Choose
 * from album" opens the gallery or file picker and allows several at once.
 * Pictures are shrunk and re-encoded here, so location data inside them is
 * dropped before anything leaves the device.
 */
export function PhotoPicker({
  photos,
  onAdd,
  onRemove,
  onRetry,
  locked,
}: {
  photos: PickedPhoto[];
  onAdd: (added: PickedPhoto[]) => void;
  onRemove: (key: string) => void;
  /** Present once the report is saved and some photos failed. */
  onRetry?: () => void;
  locked: boolean;
}) {
  const id = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const room = PHOTO_MAX_COUNT - photos.length;

  const handle = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    setMessage(null);
    setWorking(true);
    const added: PickedPhoto[] = [];
    const problems: string[] = [];
    for (const file of files) {
      if (added.length >= room) {
        problems.push(`Only ${PHOTO_MAX_COUNT} photos fit on a report.`);
        break;
      }
      if (!isImageFile(file)) {
        problems.push(`${file.name} is not a picture.`);
        continue;
      }
      try {
        const blob = await prepareReportPhoto(file);
        added.push({
          key: crypto.randomUUID(),
          name: file.name || 'photo.jpg',
          blob,
          preview: URL.createObjectURL(blob),
          status: 'ready',
        });
      } catch (e) {
        problems.push(e instanceof Error ? e.message : 'A picture could not be read.');
      }
    }
    if (added.length) onAdd(added);
    setMessage(problems.length ? Array.from(new Set(problems)).join(' ') : null);
    setWorking(false);
    if (cameraRef.current) cameraRef.current.value = '';
    if (albumRef.current) albumRef.current.value = '';
  };

  const full = room <= 0;
  const failedCount = photos.filter((p) => p.status === 'failed').length;

  return (
    <div>
      <p className="text-sm font-semibold text-ink">
        Photos <span className="font-normal text-subtle">(optional, up to {PHOTO_MAX_COUNT})</span>
      </p>
      <p id={`${id}-hint`} className="mt-0.5 text-xs text-subtle">
        A clear picture helps staff check what you saw. Photos are private to you and LGU staff, and the
        location stored inside them is removed.
      </p>

      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={locked || working || full}
          aria-describedby={`${id}-hint`}
          className={`${secondaryButtonClass} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <Camera className="w-4 h-4" aria-hidden="true" /> Take a photo
        </button>
        <button
          type="button"
          onClick={() => albumRef.current?.click()}
          disabled={locked || working || full}
          aria-describedby={`${id}-hint`}
          className={`${secondaryButtonClass} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <Images className="w-4 h-4" aria-hidden="true" /> Choose from album
        </button>
        {working && (
          <span role="status" className="flex items-center gap-2 text-xs text-subtle">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Preparing…
          </span>
        )}
      </div>

      <input ref={cameraRef} type="file" accept={PHOTO_ACCEPT} capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void handle(e.target.files)} data-testid="photo-camera" />
      <input ref={albumRef} type="file" accept={PHOTO_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void handle(e.target.files)} data-testid="photo-album" />

      {message && <p role="alert" className="mt-2 text-[13px] text-danger-ink">{message}</p>}

      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <li key={p.key} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt={`Photo ${i + 1} to attach`} className="h-full w-full object-cover" />
              {p.status === 'uploading' && (
                <span className="absolute inset-0 grid place-items-center bg-black/40 text-white" role="status">
                  <Loader2 className="w-5 h-5 animate-spin" aria-label="Uploading" />
                </span>
              )}
              {p.status === 'done' && (
                <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-white">Sent</span>
              )}
              {p.status === 'failed' && (
                <span className="absolute inset-x-0 bottom-0 bg-danger-soft px-2 py-1 text-[11px] text-danger-ink">Not sent</span>
              )}
              {!locked && p.status !== 'done' && (
                <button
                  type="button"
                  onClick={() => onRemove(p.key)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white focus-visible:outline-2 focus-visible:outline-accent-ink"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {onRetry && failedCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="alert" className="text-[13px] text-danger-ink">
            {failedCount === 1 ? '1 photo' : `${failedCount} photos`} could not be sent. Your report itself is saved.
          </p>
          <button type="button" onClick={onRetry} className={secondaryButtonClass}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" /> Try again
          </button>
        </div>
      )}
    </div>
  );
}
