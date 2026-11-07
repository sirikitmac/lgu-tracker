'use client';

import React, { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { primaryButtonClass, secondaryButtonClass } from '@/components/dpwh/ui';
import { focusRing, type Member } from '@/components/community/parts';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { StarPicker } from '@/components/reviews/Stars';
import { deleteMyReview, saveMyReview } from '@/lib/actions/reviews';
import { REVIEW_MAX, REVIEW_MIN, charCount, firstNameOf, shownName, validateReview, type Review } from '@/lib/reviews/logic';

/**
 * Write a review, or change or delete the one you already have. A native
 * <dialog> (like the photo cropper): Escape and a click outside close it, and
 * focus stays inside while it is open.
 */
export function ReviewDialog({
  member,
  existing,
  onClose,
  onSaved,
  onDeleted,
}: {
  member: Member;
  existing: Review | null;
  onClose: () => void;
  onSaved: (review: Review) => void;
  onDeleted: (id: string | null) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const countId = useId();
  const errorId = useId();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [body, setBody] = useState(existing?.body ?? '');
  const fullName = shownName(member.name, false);
  const [firstOnly, setFirstOnly] = useState(
    Boolean(existing) && existing!.displayName === firstNameOf(fullName) && firstNameOf(fullName) !== fullName,
  );
  const [error, setError] = useState<{ field: 'rating' | 'body' | 'form'; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const count = charCount(body.trim());
  const over = count > REVIEW_MAX;
  const name = shownName(member.name, firstOnly);
  const title = member.title?.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateReview({ rating, body, firstNameOnly: firstOnly });
    if (!check.ok) {
      setError({ field: check.field, text: check.error });
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveMyReview(check.value);
      if (!res.ok) return setError({ field: 'form', text: res.error });
      onSaved(res.data);
    });
  };

  const remove = () => {
    startTransition(async () => {
      const res = await deleteMyReview();
      if (!res.ok) return setError({ field: 'form', text: res.error });
      onDeleted(res.data.id);
    });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !pending) onClose(); // a click on the dimmed page behind
      }}
      className="m-auto w-[min(32rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-3xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-night/60 backdrop:backdrop-blur-sm sm:p-6"
    >
      <form onSubmit={submit} noValidate>
        <h2 id={titleId} className="text-lg font-bold tracking-tight">
          {existing ? 'Edit your review' : 'Write a review'}
        </h2>
        {existing?.status === 'hidden' && (
          <p className="mt-2 rounded-xl bg-sunken px-3 py-2 text-sm text-subtle">
            An administrator hid your review, so it is not shown on the landing page.
          </p>
        )}

        <div className="mt-4">
          <StarPicker
            value={rating}
            onChange={(n) => {
              setRating(n);
              if (error?.field === 'rating') setError(null);
            }}
            invalid={error?.field === 'rating'}
            describedBy={error?.field === 'rating' ? errorId : undefined}
          />
        </div>

        <div className="mt-4">
          <label htmlFor={bodyId} className="text-sm font-semibold">
            Your review
          </label>
          <textarea
            id={bodyId}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error?.field === 'body') setError(null);
            }}
            rows={5}
            maxLength={REVIEW_MAX * 2 + 50}
            aria-describedby={`${countId}${error?.field === 'body' ? ` ${errorId}` : ''}`}
            aria-invalid={error?.field === 'body' || over || undefined}
            placeholder="Paano nakatulong sa iyo ang Bantay Proyekto? / How has Bantay Proyekto helped you?"
            className={`mt-1.5 block w-full resize-y rounded-2xl border bg-ground px-3.5 py-3 text-[15px] leading-relaxed text-ink placeholder:text-subtle ${focusRing} ${
              error?.field === 'body' || over ? 'border-danger-ink' : 'border-line'
            }`}
          />
          <p id={countId} aria-live="polite" className={`mt-1 text-right text-xs tabular-nums ${over ? 'font-semibold text-danger-ink' : 'text-subtle'}`}>
            {count < REVIEW_MIN ? `${count} / ${REVIEW_MAX} · at least ${REVIEW_MIN}` : `${count} / ${REVIEW_MAX}`}
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-line bg-sunken/60 p-3.5">
          <p className="text-sm text-ink">Your name, job and picture will be shown publicly on the landing page.</p>
          <div className="mt-3 flex min-w-0 items-center gap-3">
            <UserAvatar name={name} avatarPath={member.avatarPath} avatarPreset={member.avatarPreset} size={36} />
            <span className="min-w-0 text-sm leading-tight">
              <span className="block font-semibold [overflow-wrap:anywhere]">{name}</span>
              {title && <span className="block text-subtle [overflow-wrap:anywhere]">{title}</span>}
            </span>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={firstOnly}
              onChange={(e) => setFirstOnly(e.target.checked)}
              className={`h-4 w-4 accent-[var(--color-accent-ink)] ${focusRing}`}
            />
            Show my first name only
          </label>
          <p className="mt-2 text-xs text-subtle">
            To change your picture or job, edit your <a href="/profile" className={`underline ${focusRing}`}>profile</a>.
          </p>
        </div>

        {error && (
          <p id={errorId} role="alert" className="mt-3 text-sm font-medium text-danger-ink">
            {error.text}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {existing ? (
            confirmDelete ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                Delete your review?
                <button type="button" disabled={pending} onClick={remove} className={`${secondaryButtonClass} text-danger-ink`}>
                  Yes, delete
                </button>
                <button type="button" disabled={pending} onClick={() => setConfirmDelete(false)} className={secondaryButtonClass}>
                  Keep it
                </button>
              </span>
            ) : (
              <button type="button" disabled={pending} onClick={() => setConfirmDelete(true)} className={`${secondaryButtonClass} text-danger-ink`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete my review
              </button>
            )
          ) : (
            <span />
          )}
          <span className="flex gap-2 sm:justify-end">
            <button type="button" disabled={pending} onClick={onClose} className={`${secondaryButtonClass} flex-1 sm:flex-none`}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={`${primaryButtonClass} flex-1 sm:flex-none`}>
              {pending ? 'Saving…' : existing ? 'Save changes' : 'Post review'}
            </button>
          </span>
        </div>
      </form>
    </dialog>
  );
}
