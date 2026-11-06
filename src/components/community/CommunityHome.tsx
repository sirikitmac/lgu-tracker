'use client';

import { Suri } from '@/components/suri/Suri';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Plus } from 'lucide-react';
import { NewPostForm } from '@/components/community/NewPostForm';
import { SortTabs } from '@/components/community/SortTabs';
import { AuthorLine, ProjectChip, SignInBanner, VoteBox, focusRing, useMember, type Member } from '@/components/community/parts';
import { accentButtonClass } from '@/components/dpwh/ui';
import { commentCount, sortItems } from '@/lib/community/logic';
import { useCommunity } from '@/lib/community/store';
import type { Post, Sort, Vote } from '@/lib/community/types';

function PostCard({
  post,
  comments,
  mine,
  member,
  onNeedSignIn,
}: {
  post: Post;
  comments: number;
  mine: Vote | undefined;
  member: Member | null;
  onNeedSignIn: () => void;
}) {
  return (
    <li className="flex gap-3 rounded-3xl border border-line bg-surface p-4 sm:gap-4 sm:p-5">
      <VoteBox targetId={post.id} baseScore={post.score} mine={mine} member={member} onNeedSignIn={onNeedSignIn} label={post.title} />
      <article className="min-w-0 flex-1" aria-label={post.title}>
        <AuthorLine authorId={post.authorId} name={post.authorName} iso={post.createdAt} />
        <h2 className="mt-2 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          <Link href={`/community/${post.id}`} className={`rounded-sm hover:text-accent-ink ${focusRing}`}>
            {post.title}
          </Link>
        </h2>
        <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[14.5px] leading-relaxed text-subtle">{post.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {post.project && <ProjectChip project={post.project} />}
          <Link href={`/community/${post.id}`} className={`inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-subtle hover:text-ink ${focusRing}`}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {comments} {comments === 1 ? 'comment' : 'comments'}
          </Link>
        </div>
      </article>
    </li>
  );
}

/** The list of discussions. Reading needs no account; writing and voting do. */
export function CommunityHome() {
  const { allPosts, allComments, votes } = useCommunity();
  const { member } = useMember();
  const [sort, setSort] = useState<Sort>('latest');
  const [composing, setComposing] = useState(false);
  const [gate, setGate] = useState<string | null>(null);

  const mineVotes = useMemo(() => (member ? votes[member.id] ?? {} : {}), [member, votes]);
  const posts = useMemo(() => sortItems(allPosts, sort, mineVotes), [allPosts, sort, mineVotes]);

  const start = () => {
    if (!member) return setGate('start a discussion');
    setGate(null);
    setComposing(true);
  };

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <Suri pose="communicator" size={104} className="hidden shrink-0 sm:block" />
          <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Bantay Community<span className="text-accent-ink">.</span>
          </h1>
          <p className="mt-3 max-w-[52ch] text-[16px] leading-snug text-subtle">
            Usapang bayan tungkol sa mga proyekto at alalahanin ng komunidad. Talk about public projects and what is happening in your town.
          </p>
          </div>
        </div>
        <button type="button" onClick={start} className={`${accentButtonClass} h-11 shrink-0 px-5`}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New discussion
        </button>
      </header>

      {gate && !member && <div className="mb-4"><SignInBanner what={gate} /></div>}

      {composing && member && (
        <div className="mb-6">
          <NewPostForm
            member={member}
            onDone={() => {
              setComposing(false);
              setSort('latest');
            }}
          />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <SortTabs value={sort} onChange={setSort} label="Sort discussions" />
        <p className="text-[13px] text-subtle" aria-live="polite">
          {posts.length} {posts.length === 1 ? 'discussion' : 'discussions'}
        </p>
      </div>

      <ul className="space-y-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            comments={commentCount(allComments, post.id)}
            mine={mineVotes[post.id]}
            member={member}
            onNeedSignIn={() => setGate('vote')}
          />
        ))}
      </ul>

      <p className="mt-6 text-[13px] text-subtle">
        These are sample discussions by fictional people, shown for preview. What you post, comment and vote is saved in this browser only.
      </p>
    </>
  );
}
