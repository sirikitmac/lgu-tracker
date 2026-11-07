'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowBigDown, ArrowBigUp, Building2, LogIn } from 'lucide-react';
import { Avatar } from '@/components/community/Avatar';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { primaryButtonClass, secondaryButtonClass } from '@/components/dpwh/ui';
import { useSessionRole } from '@/lib/auth/useSessionRole';
import { displayScore, toggleVote } from '@/lib/community/logic';
import { resolveAuthor } from '@/lib/community/profiles';
import { setVote } from '@/lib/community/store';
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
export function SignInBanner({ what }: { what: string }) {
  const pathname = usePathname() ?? '/community';
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-line bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink">
        <span className="font-semibold">Sign in to {what}.</span> Anyone can read the discussions; an account is needed to take part.
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

/**
 * Who wrote something. Your own posts and comments show your current name, job
 * and picture from your profile (`self`); the sample people keep theirs.
 */
export function AuthorLine({
  authorId,
  name,
  iso,
  size = 32,
  self,
}: {
  authorId: string;
  name?: string;
  iso: string;
  size?: number;
  self?: Member | null;
}) {
  const mine = self && self.id === authorId ? self : null;
  const person = resolveAuthor(authorId, name);
  const shownName = mine ? mine.name : person.name;
  const shownTag = mine ? mine.title?.trim() || 'Member' : person.tag;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {mine && (mine.avatarPath || mine.avatarPreset) ? (
        <UserAvatar name={shownName} avatarPath={mine.avatarPath} avatarPreset={mine.avatarPreset} size={size} />
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
  targetId,
  baseScore,
  mine,
  member,
  onNeedSignIn,
  direction = 'column',
  label,
}: {
  targetId: string;
  baseScore: number;
  mine: Vote | undefined;
  member: Member | null;
  onNeedSignIn: () => void;
  direction?: 'column' | 'row';
  label: string;
}) {
  const press = (vote: Vote) => {
    if (!member) return onNeedSignIn();
    setVote(member.id, targetId, toggleVote(mine, vote));
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
      <span className="min-w-8 text-center text-[13.5px] font-bold tabular-nums text-ink" aria-label={`Score ${displayScore(baseScore, mine)}`}>
        {displayScore(baseScore, mine)}
      </span>
      {btn(-1, ArrowBigDown, 'Downvote')}
    </div>
  );
}
