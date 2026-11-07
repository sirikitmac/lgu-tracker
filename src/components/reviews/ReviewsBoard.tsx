'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { EyeOff, PenLine, Quote, Star } from 'lucide-react';
import { Avatar } from '@/components/community/Avatar';
import { SignInBanner, focusRing, useMember } from '@/components/community/parts';
import { primaryButtonClass } from '@/components/dpwh/ui';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { ReviewDialog } from '@/components/reviews/ReviewDialog';
import { Stars } from '@/components/reviews/Stars';
import { setReviewStatus } from '@/lib/actions/reviews';
import { useSessionRole } from '@/lib/auth/useSessionRole';
import type { Profile } from '@/lib/community/types';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { announceReviewsChanged, applyLocalChange, useLiveReviews } from '@/lib/reviews/live';
import {
  REVIEW_COLUMNS,
  averageRating,
  mergeReviews,
  reviewFromRow,
  type Review,
  type ReviewCard,
  type SampleReview,
} from '@/lib/reviews/logic';
import { ADMIN_ROLES } from '@/types/auth';

export interface SampleCard extends SampleReview {
  person: Profile;
}

/** My own review, including one an administrator hid (only I and administrators can read it). */
function useMyReview(userId: string | null, published: readonly Review[]) {
  const [fetched, setFetched] = useState<{ userId: string; review: Review | null } | null>(null);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId) return;
    let active = true;
    void client
      .from('reviews')
      .select(REVIEW_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => active && setFetched({ userId, review: reviewFromRow(data) }));
    return () => {
      active = false;
    };
  }, [userId]);
  const live = userId ? published.find((r) => r.userId === userId) : undefined;
  const mine = live ?? (fetched && fetched.userId === userId ? fetched.review : null);
  return [mine ?? null, (review: Review | null) => userId && setFetched({ userId, review })] as const;
}

/**
 * The live part of "Ano ang sabi nila?": the rating summary, the "Write a
 * review" button and the cards. Real reviews come first, newest first; sample
 * reviews fill the grid up to six cards and are labelled as samples.
 *
 * Cards never jump while someone is reading (pointer or focus inside the list)
 * or typing (the dialog is open): new reviews wait behind a "Show" button and
 * come in when the reader moves on. Edits and removals apply at once.
 */
export function ReviewsBoard({ samples }: { samples: SampleCard[] }) {
  const { reviews: latest, loaded } = useLiveReviews();
  const session = useSessionRole();
  const { member } = useMember();
  const isAdmin = session.state === 'in' && ADMIN_ROLES.includes(session.role);
  const [mine, setMine] = useMyReview(member?.id ?? null, latest);

  const [shown, setShown] = useState<Review[]>(latest);
  const [hovering, setHovering] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [askSignIn, setAskSignIn] = useState(false);
  const [notice, setNotice] = useState<{ text: string; undo?: Review } | null>(null);
  const [moderating, startModeration] = useTransition();
  const busy = hovering || focusInside || dialogOpen;

  // Keep what is on screen in step with the live list, without moving cards under a reader.
  useEffect(() => {
    if (!busy) {
      setShown(latest);
      return;
    }
    const byId = new Map(latest.map((r) => [r.id, r]));
    setShown((current) => {
      const next = current.filter((r) => byId.has(r.id)).map((r) => byId.get(r.id)!);
      const same = next.length === current.length && next.every((r, i) => r === current[i]);
      return same ? current : next;
    });
  }, [latest, busy]);
  const shownIds = useMemo(() => new Set(shown.map((r) => r.id)), [shown]);
  const waiting = latest.filter((r) => !shownIds.has(r.id)).length;

  const cards = useMemo(() => mergeReviews(shown, samples), [shown, samples]);
  const average = averageRating(latest);

  // Cards that were not on screen before fade in (CSS respects reduced motion).
  const seen = useRef<Set<string> | null>(null);
  const fresh = new Set<string>();
  if (seen.current) for (const c of cards) if (!seen.current.has(c.key)) fresh.add(c.key);
  useEffect(() => {
    if (!loaded) return;
    seen.current = new Set(cards.map((c) => c.key));
  });

  const openWriter = () => {
    if (session.state === 'loading') return;
    if (!member) return setAskSignIn(true);
    setAskSignIn(false);
    setDialogOpen(true);
  };

  const closeWriter = useCallback(() => setDialogOpen(false), []);

  const hide = (review: Review, status: 'hidden' | 'published') =>
    startModeration(async () => {
      const res = await setReviewStatus(review.id, status);
      if (!res.ok) return setNotice({ text: res.error });
      applyLocalChange({ type: 'upsert', review: res.data });
      announceReviewsChanged();
      setNotice(status === 'hidden' ? { text: `Review by ${review.displayName} hidden for everyone.`, undo: res.data } : { text: 'Review shown again.' });
    });

  return (
    <div
      onFocus={() => setFocusInside(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusInside(false);
      }}
    >
      <div data-reveal className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {average !== null ? (
          <p className="flex items-center gap-2.5 text-ink">
            <Star className="h-6 w-6 fill-current text-accent-ink" aria-hidden="true" />
            <span className="text-[28px] font-bold leading-none tabular-nums">{average.toFixed(1)}</span>
            <span className="text-[15px] text-subtle">
              <span className="sr-only">average rating out of 5, </span>
              from {latest.length} {latest.length === 1 ? 'review' : 'reviews'}
            </span>
          </p>
        ) : (
          <span />
        )}
        <button type="button" onClick={openWriter} aria-haspopup="dialog" className={`${primaryButtonClass} self-start sm:self-auto`}>
          <PenLine className="h-4 w-4" aria-hidden="true" /> {mine ? 'Edit my review' : 'Write a review'}
        </button>
      </div>

      {askSignIn && !member && (
        <div className="mt-4">
          <SignInBanner what="write a review" note="Anyone can read the reviews; an account is needed to write one." next="/#reviews" />
        </div>
      )}

      <div aria-live="polite" className="min-h-0">
        {notice && (
          <p className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-ink">
            {notice.text}
            {notice.undo && (
              <button type="button" disabled={moderating} onClick={() => hide(notice.undo!, 'published')} className={`font-semibold underline ${focusRing}`}>
                Undo
              </button>
            )}
            <button type="button" onClick={() => setNotice(null)} className={`ml-auto text-subtle underline ${focusRing}`}>
              Dismiss
            </button>
          </p>
        )}
        {waiting > 0 && (
          <button
            type="button"
            onClick={() => setShown(latest)}
            className={`mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-night ${focusRing}`}
          >
            {waiting === 1 ? '1 new review' : `${waiting} new reviews`} · Show
          </button>
        )}
      </div>

      <ul
        data-reveal
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3"
      >
        {cards.map((card, i) => (
          <ReviewCardItem
            key={card.key}
            card={card}
            featured={i === 0}
            fresh={fresh.has(card.key)}
            mine={card.kind === 'real' && card.review.userId === member?.id}
            canModerate={isAdmin}
            moderating={moderating}
            onHide={(r) => hide(r, 'hidden')}
          />
        ))}
      </ul>

      <p data-reveal className="mt-6 text-[13px] text-subtle">
        Cards marked “Sample review” are written by fictional people and are not counted in the rating.
      </p>

      {dialogOpen && member && (
        <ReviewDialog
          member={member}
          existing={mine}
          onClose={closeWriter}
          onSaved={(review) => {
            setMine(review);
            applyLocalChange({ type: 'upsert', review });
            setDialogOpen(false);
            setNotice({ text: review.status === 'hidden' ? 'Saved. Your review is still hidden by an administrator.' : 'Thank you! Your review is on the page.' });
          }}
          onDeleted={(id) => {
            setMine(null);
            if (id) applyLocalChange({ type: 'remove', id });
            setDialogOpen(false);
            setNotice({ text: 'Your review was deleted.' });
          }}
        />
      )}
    </div>
  );
}

function ReviewCardItem({
  card,
  featured,
  fresh,
  mine,
  canModerate,
  moderating,
  onHide,
}: {
  card: ReviewCard<SampleCard>;
  featured: boolean;
  fresh: boolean;
  mine: boolean;
  canModerate: boolean;
  moderating: boolean;
  onHide: (review: Review) => void;
}) {
  const muted = featured ? 'text-white/75' : 'text-subtle';
  const real = card.kind === 'real' ? card.review : null;
  const sample = card.kind === 'sample' ? card.sample : null;
  const rating = real ? real.rating : sample!.rating;

  return (
    <li
      className={`min-w-0 rounded-[24px] p-6 ${fresh ? 'review-in' : ''} ${
        featured ? 'bg-night text-white dark:ring-1 dark:ring-white/12' : 'bg-surface border border-line text-ink'
      }`}
    >
      <figure className="flex h-full min-w-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Quote className={`h-6 w-6 shrink-0 ${featured ? 'text-signal' : 'text-accent-ink'}`} aria-hidden="true" />
          {sample && (
            <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${featured ? 'bg-white/12 text-white/85' : 'bg-sunken text-subtle'}`}>
              Sample review
            </span>
          )}
          {real && mine && (
            <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${featured ? 'bg-signal text-night' : 'bg-accent-soft text-ink'}`}>
              Your review
            </span>
          )}
        </div>
        <Stars rating={rating} className={`mt-4 ${featured ? 'text-signal' : 'text-accent-ink'}`} />
        <blockquote
          lang={sample ? (sample.lang === 'tl' ? 'fil' : 'en') : undefined}
          className="mt-3 flex-1 whitespace-pre-line text-[16px] leading-relaxed [overflow-wrap:anywhere]"
        >
          {real ? real.body : sample!.body}
        </blockquote>
        <figcaption className="mt-6 flex min-w-0 items-center gap-3">
          {real ? (
            <UserAvatar name={real.displayName} avatarPath={real.avatarPath} avatarPreset={real.avatarPreset} size={44} />
          ) : (
            <Avatar profile={sample!.person} size={44} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold [overflow-wrap:anywhere]">{real ? real.displayName : sample!.person.name}</span>
            <span className={`block text-[13px] leading-snug [overflow-wrap:anywhere] ${muted}`}>
              {real ? real.jobTitle || 'Bantay Proyekto user' : `${sample!.person.tag} · ${sample!.person.place}`}
            </span>
          </span>
          {real && canModerate && (
            <button
              type="button"
              disabled={moderating}
              onClick={() => onHide(real)}
              aria-label={`Hide the review by ${real.displayName}`}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                featured ? 'text-white/80 hover:bg-white/10' : 'text-subtle hover:bg-sunken'
              } ${focusRing}`}
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Hide
            </button>
          )}
        </figcaption>
      </figure>
    </li>
  );
}
