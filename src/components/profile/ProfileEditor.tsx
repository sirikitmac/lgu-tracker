'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Trash2 } from 'lucide-react';
import { controlClass, primaryButtonClass, secondaryButtonClass, secondaryButtonSmClass } from '@/components/dpwh/ui';
import { PhotoCropper } from '@/components/profile/PhotoCropper';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { useToast } from '@/components/ui/Toast';
import { updateProfile } from '@/lib/actions/profile';
import { isImageFile } from '@/lib/reports/photos';
import {
  AVATAR_ACCEPT,
  AVATAR_BUCKET,
  AVATAR_PRESETS,
  JOB_SUGGESTIONS,
  NAME_MAX,
  TITLE_MAX,
  avatarStoragePath,
  validateProfile,
} from '@/lib/profile/avatars';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export interface SavedProfile {
  fullName: string;
  positionTitle: string;
  avatarPath: string | null;
  avatarPreset: string | null;
}

/** The photo choice: the one already saved, a new one waiting to be saved, or none. */
type Photo = { kind: 'saved'; path: string } | { kind: 'new'; blob: Blob; url: string } | null;

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
/** A picture file bigger than this is not even tried; the crop shrinks the rest. */
const PICK_MAX_BYTES = 25 * 1024 * 1024;

const photoOf = (p: SavedProfile): Photo => (p.avatarPath ? { kind: 'saved', path: p.avatarPath } : null);

/**
 * Edit your name, job title and picture: upload a photo (cropped to a square
 * first) or pick one of the free avatars. Nothing changes until "Save changes".
 * The job title is only a label; what you can do is set by an administrator.
 */
export function ProfileEditor({
  userId,
  email,
  roleLabel,
  initial,
}: {
  userId: string;
  email: string | null;
  roleLabel: string;
  initial: SavedProfile;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [base, setBase] = useState<SavedProfile>(initial);
  const [name, setName] = useState(initial.fullName);
  const [title, setTitle] = useState(initial.positionTitle);
  const [preset, setPreset] = useState<string | null>(initial.avatarPreset);
  const [photo, setPhoto] = useState<Photo>(photoOf(initial));
  const [cropping, setCropping] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ field: 'fullName' | 'positionTitle' | 'avatar' | 'form'; message: string } | null>(null);

  // A picture waiting to be saved holds an object URL; let it go when replaced or when leaving.
  const liveUrl = useRef<string | null>(null);
  useEffect(() => {
    liveUrl.current = photo?.kind === 'new' ? photo.url : null;
  }, [photo]);
  useEffect(() => () => {
    if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
  }, []);

  const savedPath = photo?.kind === 'saved' ? photo.path : null;
  const dirty =
    name.trim() !== base.fullName ||
    title.trim() !== base.positionTitle ||
    preset !== base.avatarPreset ||
    photo?.kind === 'new' ||
    savedPath !== base.avatarPath;

  function dropNewPhoto() {
    if (photo?.kind === 'new') URL.revokeObjectURL(photo.url);
  }

  function pickPreset(next: string | null) {
    dropNewPhoto();
    setPhoto(null);
    setPreset(next);
    setProblem(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still fires
    if (!file) return;
    if (!isImageFile(file)) return setProblem({ field: 'avatar', message: 'Choose a picture file (JPEG, PNG or WebP).' });
    if (file.size > PICK_MAX_BYTES) return setProblem({ field: 'avatar', message: 'That picture is too large. Choose one under 25 MB.' });
    setProblem(null);
    setCropping(file);
  }

  function onCropped(blob: Blob) {
    dropNewPhoto();
    setPhoto({ kind: 'new', blob, url: URL.createObjectURL(blob) });
    setPreset(null);
    setCropping(null);
    setProblem(null);
  }

  function reset() {
    dropNewPhoto();
    setName(base.fullName);
    setTitle(base.positionTitle);
    setPreset(base.avatarPreset);
    setPhoto(photoOf(base));
    setProblem(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    setProblem(null);

    const newPath = photo?.kind === 'new' ? avatarStoragePath(userId, crypto.randomUUID()) : null;
    const finalPath = newPath ?? savedPath;
    const check = validateProfile({ fullName: name, positionTitle: title, avatarPath: finalPath, avatarPreset: preset }, userId);
    if (!check.ok) {
      setProblem({ field: check.field, message: check.error });
      document.getElementById(`${id}-${check.field === 'fullName' ? 'name' : 'job'}`)?.focus();
      return;
    }

    setSaving(true);
    const client = getSupabaseBrowserClient();
    let uploaded = false;
    try {
      if (photo?.kind === 'new' && newPath) {
        if (!client) throw new Error('offline');
        const up = await client.storage.from(AVATAR_BUCKET).upload(newPath, photo.blob, { contentType: 'image/jpeg', upsert: false });
        if (up.error) throw up.error;
        uploaded = true;
      }

      const result = await updateProfile(check.value);
      if (!result.ok) {
        if (uploaded && client && newPath) await client.storage.from(AVATAR_BUCKET).remove([newPath]); // no orphan file
        setProblem({ field: 'form', message: result.error });
        setSaving(false);
        return;
      }

      // Saved. The photo that was replaced or dropped is no longer needed (best effort).
      if (client && base.avatarPath && base.avatarPath !== result.data.avatarPath) {
        void client.storage.from(AVATAR_BUCKET).remove([base.avatarPath]);
      }
      const next: SavedProfile = { ...result.data };
      dropNewPhoto();
      setBase(next);
      setName(next.fullName);
      setTitle(next.positionTitle);
      setPreset(next.avatarPreset);
      setPhoto(photoOf(next));
      toast({ tone: 'success', title: 'Profile saved' });
      router.refresh(); // the sidebar and the bar pick up the new name and picture
    } catch {
      if (uploaded && client && newPath) await client.storage.from(AVATAR_BUCKET).remove([newPath]);
      setProblem({
        field: 'form',
        message: photo?.kind === 'new' ? 'Your photo could not be uploaded. Check your connection and try again.' : 'Your profile could not be saved. Try again.',
      });
    }
    setSaving(false);
  }

  const avatarProps = {
    avatarPath: photo?.kind === 'saved' ? photo.path : null,
    previewUrl: photo?.kind === 'new' ? photo.url : null,
    avatarPreset: preset,
  };
  const fieldError = (field: string) => (problem?.field === field ? problem.message : null);

  return (
    <form onSubmit={save} noValidate className="max-w-2xl space-y-6" aria-label="Edit your profile">
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby={`${id}-pic`}>
        <h2 id={`${id}-pic`} className="text-base font-bold tracking-tight text-ink">
          Picture
        </h2>

        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <UserAvatar name={name} size={104} decorative={false} className="ring-1 ring-line" {...avatarProps} />
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <input ref={fileInput} type="file" accept={AVATAR_ACCEPT} onChange={onFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
              <button type="button" onClick={() => fileInput.current?.click()} className={secondaryButtonClass}>
                <Camera className="h-4 w-4" aria-hidden="true" /> {photo ? 'Change photo' : 'Upload a photo'}
              </button>
              {photo && (
                <button type="button" onClick={() => pickPreset(null)} className={secondaryButtonClass}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove photo
                </button>
              )}
            </div>
            <p className="text-center text-xs leading-relaxed text-subtle sm:text-left">
              JPEG, PNG or WebP. You will frame it as a square next. On a phone you can take a new picture or choose from your album.
            </p>
          </div>
        </div>

        {fieldError('avatar') && (
          <p role="alert" className="mt-3 text-[13px] text-danger-ink">
            {fieldError('avatar')}
          </p>
        )}

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-ink">
            Or pick a free avatar <span className="font-normal text-subtle">(no photo needed)</span>
          </legend>
          <div className="mt-3 grid grid-cols-4 gap-2.5 min-[420px]:grid-cols-5 sm:grid-cols-7">
            <label className="group relative flex cursor-pointer flex-col items-center" title="Use my initials">
              <input
                type="radio"
                name={`${id}-avatar`}
                checked={!photo && preset === null}
                onChange={() => pickPreset(null)}
                aria-label="Use my initials"
                className="peer sr-only"
              />
              <span className="block rounded-full p-[3px] ring-2 ring-transparent transition peer-checked:ring-accent-ink group-hover:ring-line-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink">
                <UserAvatar name={name} size={56} />
              </span>
              <span className="mt-1 block text-center text-[11px] text-subtle">Initials</span>
            </label>
            {AVATAR_PRESETS.map((p) => (
              <label key={p.id} className="group relative flex cursor-pointer flex-col items-center" title={p.label}>
                <input
                  type="radio"
                  name={`${id}-avatar`}
                  checked={!photo && preset === p.id}
                  onChange={() => pickPreset(p.id)}
                  aria-label={p.label}
                  className="peer sr-only"
                />
                <span className="block rounded-full p-[3px] ring-2 ring-transparent transition peer-checked:ring-accent-ink group-hover:ring-line-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-ink">
                  <UserAvatar name={name} avatarPreset={p.id} size={56} />
                </span>
              </label>
            ))}
          </div>
          {photo && <p className="mt-2 text-xs text-subtle">You are using your own photo. Pick an avatar to switch.</p>}
        </fieldset>
      </section>

      <section className="space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby={`${id}-about`}>
        <h2 id={`${id}-about`} className="text-base font-bold tracking-tight text-ink">
          About you
        </h2>

        <div>
          <label htmlFor={`${id}-name`} className="block text-sm font-semibold text-ink">
            Name
          </label>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX + 20}
            autoComplete="name"
            aria-invalid={Boolean(fieldError('fullName'))}
            aria-describedby={fieldError('fullName') ? `${id}-name-error` : undefined}
            className={`${controlClass} mt-2 h-11`}
          />
          {fieldError('fullName') && (
            <p id={`${id}-name-error`} role="alert" className="mt-1 text-[13px] text-danger-ink">
              {fieldError('fullName')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-job`} className="block text-sm font-semibold text-ink">
            Job <span className="font-normal text-subtle">(optional)</span>
          </label>
          <input
            id={`${id}-job`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX + 20}
            placeholder="Teacher, Engineer, Student…"
            autoComplete="organization-title"
            aria-invalid={Boolean(fieldError('positionTitle'))}
            aria-describedby={`${id}-job-hint${fieldError('positionTitle') ? ` ${id}-job-error` : ''}`}
            className={`${controlClass} mt-2 h-11`}
          />
          <div className="mt-1 flex justify-between gap-3 text-xs text-subtle">
            <span id={`${id}-job-hint`}>Shown beside your name in the community. It is only a label and does not change what you can do.</span>
            <span className="tabular-nums shrink-0">
              {title.trim().length} / {TITLE_MAX}
            </span>
          </div>
          {fieldError('positionTitle') && (
            <p id={`${id}-job-error`} role="alert" className="mt-1 text-[13px] text-danger-ink">
              {fieldError('positionTitle')}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Job ideas">
            {JOB_SUGGESTIONS.map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setTitle(j)}
                aria-pressed={title.trim() === j}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${focusRing} ${
                  title.trim() === j ? 'border-ink bg-ink text-on-ink' : 'border-line bg-sunken text-ink hover:border-line-strong'
                }`}
              >
                {j}
              </button>
            ))}
          </div>
        </div>

        <dl className="grid gap-x-6 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-muted">Email</dt>
            <dd className="mt-0.5 break-all text-ink">{email ?? 'Not shown'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-muted">Access role</dt>
            <dd className="mt-0.5 text-ink">
              {roleLabel} <span className="text-subtle">· set by an administrator</span>
            </dd>
          </div>
        </dl>
      </section>

      {problem?.field === 'form' && (
        <p role="alert" className="rounded-2xl border border-danger-ink/30 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          {problem.message}
        </p>
      )}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-raise backdrop-blur">
        <p className="mr-auto text-[13px] text-subtle" role="status" aria-live="polite">
          {saving ? 'Saving…' : dirty ? 'You have unsaved changes.' : (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-accent-ink" aria-hidden="true" /> All changes saved
            </span>
          )}
        </p>
        <button type="button" onClick={reset} disabled={!dirty || saving} className={`${secondaryButtonSmClass} disabled:opacity-50`}>
          Undo changes
        </button>
        <button type="submit" disabled={!dirty || saving} className={`${primaryButtonClass} disabled:opacity-50`}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {cropping && <PhotoCropper file={cropping} onCancel={() => setCropping(null)} onDone={onCropped} />}
    </form>
  );
}
