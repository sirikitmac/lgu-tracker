'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Plus } from 'lucide-react';
import { NewPostForm } from '@/components/community/NewPostForm';
import { SortTabs } from '@/components/community/SortTabs';
import { AuthorLine, DeleteButton, ProjectChip, SignInBanner, VoteBox, focusRing, useMember, type Member } from '@/components/community/parts';
import { accentButtonClass } from '@/components/dpwh/ui';
import { useCommunity } from '@/lib/community/live';
import { sortItems } from '@/lib/community/logic';
import type { Post, Sort, Vote } from '@/lib/community/types';

function PostCard({
  post,
  mine,
  member,
  onNeedSignIn,
  onError,
}: {
  post: Post;
  mine: Vote | undefined;
  member: Member | null;
  onNeedSignIn: () => void;
  onError: (message: string) => void;
}) {
  const comments = post.commentCount ?? 0;
  const canDelete = !!member && (member.isAdmin || (!post.sample && post.authorId === member.id));
  return (
    <li className="flex gap-3 rounded-3xl border border-line bg-surface p-4 sm:gap-4 sm:p-5">
      <VoteBox kind="post" targetId={post.id} score={post.score} mine={mine} member={member} onNeedSignIn={onNeedSignIn} onError={onError} label={post.title} />
      <article className="min-w-0 flex-1" aria-label={post.title}>
        <AuthorLine authorId={post.authorId} name={post.authorName} iso={post.createdAt} self={member} snapshot={post} />
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
          {post.sample && <span className="rounded-full bg-sunken px-2.5 py-0.5 text-[12px] font-medium text-subtle">Sample</span>}
          {canDelete && <DeleteButton kind="post" id={post.id} label={post.title} />}
        </div>
      </article>
    </li>
  );
}

/** The list of discussions. Reading needs no account; writing and voting do. */
export function CommunityHome() {
  const { posts: allPosts, myVotes, loaded, failed } = useCommunity();
  const { member } = useMember();
  const [sort, setSort] = useState<Sort>('latest');
  const [composing, setComposing] = useState(false);
  const [gate, setGate] = useState<string | null>(null);

  const [problem, setProblem] = useState<string | null>(null);

  const mineVotes = member ? myVotes : {};
  const posts = useMemo(() => sortItems(allPosts, sort), [allPosts, sort]);

  const start = () => {
    if (!member) return setGate('start a discussion');
    setGate(null);
    setComposing(true);
  };

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Bantay Community<span className="text-accent-ink">.</span>
          </h1>
          <p className="mt-3 max-w-[52ch] text-[16px] leading-snug text-subtle">
            Usapang bayan tungkol sa mga proyekto at alalahanin ng komunidad. Talk about public projects and what is happening in your town.
          </p>
        </div>
        <button type="button" onClick={start} className={`${accentButtonClass} h-11 shrink-0 px-5`}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New discussion
        </button>
      </header>

      {gate && !member && <div className="mb-4"><SignInBanner what={gate} /></div>}

      {problem && <p role="alert" className="mb-4 text-[13px] text-danger-ink">{problem}</p>}

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

      {!loaded ? (
        <p role="status" className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-subtle">Loading discussions…</p>
      ) : failed ? (
        <p role="alert" className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-danger-ink">
          The discussions could not be loaded. Check your connection and reload the page.
        </p>
      ) : posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-subtle">No discussions yet. Start the first one.</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              mine={mineVotes[post.id]}
              member={member}
              onNeedSignIn={() => setGate('vote')}
              onError={setProblem}
            />
          ))}
        </ul>
      )}

      <p className="mt-6 text-[13px] text-subtle">
        Discussions marked Sample are made-up examples. Everything else is written by people using Bantay Proyekto, and everyone sees it as it happens.
      </p>
    </>
  );
}
