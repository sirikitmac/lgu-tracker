'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowBigDown, ArrowBigUp, Building2, LogIn, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/community/Avatar';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { primaryButtonClass, secondaryButtonClass } from '@/components/dpwh/ui';
import { useSessionRole } from '@/lib/auth/useSessionRole';
import { castVote, removeItem } from '@/lib/community/live';
import { toggleVote } from '@/lib/community/logic';
import { profileById, resolveAuthor } from '@/lib/community/profiles';
import type { ProjectLink, Vote } from '@/lib/community/types';
import { agoLabel, stampLabel } from '@/lib/notifications/time';

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

export interface Member {
  id: string;
  name: string;
  /** The job title and picture the person chose on their profile. */
  title?: string | null;
  avatarPath?: string | null;
  avatarPreset?: string | null;
  /** Administrators can remove any discussion or comment. */
  isAdmin?: boolean;
}

/** The signed-in person, or null. Reading is open to everyone; every write needs this. */
export function useMember(): { loading: boolean; member: Member | null } {
  const session = useSessionRole();
  if (session.state === 'loading') return { loading: true, member: null };
  if (session.state === 'out') return { loading: false, member: null };
  return {
    loading: false,
    member: {
      id: session.id,
      name: session.name || 'Community member',
      title: session.title,
      avatarPath: session.avatarPath,
      avatarPreset: session.avatarPreset,
      isAdmin: session.role === 'lgu_admin' || session.role === 'super_admin',
    },
  };
}

/** "5 min ago" once the page is in the browser; the same fixed date text on the server, so nothing mismatches. */
export function Ago({ iso }: { iso: string }) {
  const [text, setText] = useState(() => stampLabel(iso));
  useEffect(() => {
    setText(agoLabel(iso));
  }, [iso]);
  return (
    <time dateTime={iso} title={stampLabel(iso)}>
      {text}
    </time>
  );
}

/** Shown when someone who is not signed in tries to write or vote. */
export function SignInBanner({
  what,
  note = 'Anyone can read the discussions; an account is needed to take part.',
  next,
}: {
  what: string;
  note?: string;
  /** Where to come back to after signing in; defaults to this page. */
  next?: string;
}) {
  const current = usePathname();
  const pathname = next ?? current ?? '/community';
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-line bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink">
        <span className="font-semibold">Sign in to {what}.</span> {note}
      </p>
      <div className="flex gap-2">
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={primaryButtonClass}>
          <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
        </Link>
        <Link href="/register" className={secondaryButtonClass}>
          Create account
        </Link>
      </div>
    </div>
  );
}

/** How an author appears: the copy saved with their post or comment. */
export interface AuthorSnapshot {
  title?: string | null;
  avatarPath?: string | null;
  avatarPreset?: string | null;
  sample?: boolean;
}

/**
 * Who wrote something. Your own posts and comments show your current name, job
 * and picture from your profile (`self`); other people show the name, job and
 * picture saved with what they wrote (the database refreshes them when the
 * person edits their profile); the sample people keep theirs.
 */
export function AuthorLine({
  authorId,
  name,
  iso,
  size = 32,
  self,
  snapshot,
}: {
  authorId: string;
  name?: string;
  iso: string;
  size?: number;
  self?: Member | null;
  snapshot?: AuthorSnapshot;
}) {
  const mine = self && self.id === authorId ? self : null;
  const sample = snapshot?.sample ? profileById(authorId) : undefined;
  const person = sample ?? resolveAuthor(authorId, name);
  const shown = mine ?? (sample ? null : snapshot);
  const shownName = mine ? mine.name : person.name;
  const shownTag = mine ? mine.title?.trim() || 'Member' : sample ? sample.tag : snapshot?.title?.trim() || 'Member';
  const avatarPath = shown?.avatarPath;
  const avatarPreset = shown?.avatarPreset;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {avatarPath || avatarPreset ? (
        <UserAvatar name={shownName} avatarPath={avatarPath} avatarPreset={avatarPreset} size={size} />
      ) : (
        <Avatar profile={person} size={size} />
      )}
      <p className="min-w-0 text-[13px] leading-tight text-subtle">
        <span className="font-semibold text-ink">{shownName}</span>
        {shownTag !== 'Member' && <span className="hidden sm:inline"> · {shownTag}</span>}
        <span className="block sm:inline">
          <span className="hidden sm:inline"> · </span>
          <Ago iso={iso} />
        </span>
      </p>
    </div>
  );
}

/** "Delete" for your own post or comment (or any, for an administrator), with a second step so it is not by accident. */
export function DeleteButton({ kind, id, onDeleted, label }: { kind: 'post' | 'comment'; id: string; onDeleted?: () => void; label: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    const res = await removeItem(kind, id);
    setBusy(false);
    if (res.ok) onDeleted?.();
    else {
      setError(res.error);
      setAsking(false);
    }
  };
  if (!asking) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setAsking(true);
          }}
          aria-label={`Delete ${label}`}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-subtle hover:bg-sunken hover:text-danger-ink ${focusRing}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
        </button>
        {error && <span role="alert" className="text-[13px] text-danger-ink">{error}</span>}
      </>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[13px]" role="group" aria-label={`Confirm delete ${label}`}>
      <span className="text-subtle">Delete this{kind === 'post' ? ' discussion and its comments' : ' comment and its replies'}?</span>
      <button type="button" onClick={run} disabled={busy} className={`h-9 rounded-full px-3 font-semibold text-danger-ink hover:bg-sunken disabled:opacity-60 ${focusRing}`}>
        {busy ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button type="button" onClick={() => setAsking(false)} disabled={busy} className={`h-9 rounded-full px-3 font-semibold text-subtle hover:bg-sunken ${focusRing}`}>
        Keep
      </button>
    </span>
  );
}

export function ProjectChip({ project }: { project: ProjectLink }) {
  return (
    <Link
      href={project.href}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-sunken px-3 py-1 text-[12.5px] font-medium text-ink hover:border-line-strong ${focusRing}`}
    >
      <Building2 className="h-3.5 w-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
      <span className="truncate">{project.title}</span>
      {project.code && <span className="hidden font-mono text-[11.5px] text-subtle sm:inline">{project.code}</span>}
    </Link>
  );
}

/**
 * Up and down arrows with the score between. Anyone can see the score; a vote
 * needs an account, so a visitor pressing an arrow is told to sign in instead.
 */
export function VoteBox({
  kind,
  targetId,
  score,
  mine,
  member,
  onNeedSignIn,
  onError,
  direction = 'column',
  label,
}: {
  kind: 'post' | 'comment';
  targetId: string;
  /** Everyone's votes added up, yours included. */
  score: number;
  mine: Vote | undefined;
  member: Member | null;
  onNeedSignIn: () => void;
  onError?: (message: string) => void;
  direction?: 'column' | 'row';
  label: string;
}) {
  const press = (vote: Vote) => {
    if (!member) return onNeedSignIn();
    void castVote(kind, targetId, toggleVote(mine, vote)).then((res) => {
      if (!res.ok) onError?.(res.error);
    });
  };
  const btn = (vote: Vote, Icon: typeof ArrowBigUp, text: string) => {
    const on = mine === vote;
    return (
      <button
        type="button"
        onClick={() => press(vote)}
        aria-pressed={on}
        aria-label={`${text}: ${label}`}
        className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${focusRing} ${
          on ? (vote === 1 ? 'bg-accent text-night' : 'bg-ink text-on-ink') : 'text-subtle hover:bg-sunken hover:text-ink'
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </button>
    );
  };
  return (
    <div className={`flex items-center ${direction === 'column' ? 'flex-col' : 'flex-row gap-1'}`}>
      {btn(1, ArrowBigUp, 'Upvote')}
      <span className="min-w-8 text-center text-[13.5px] font-bold tabular-nums text-ink" aria-label={`Score ${score}`}>
        {score}
      </span>
      {btn(-1, ArrowBigDown, 'Downvote')}
    </div>
  );
}
