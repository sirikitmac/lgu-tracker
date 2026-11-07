'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, CornerDownRight } from 'lucide-react';
import { CommentForm } from '@/components/community/CommentForm';
import { SortTabs } from '@/components/community/SortTabs';
import { AuthorLine, ProjectChip, SignInBanner, VoteBox, focusRing, useMember, type Member } from '@/components/community/parts';
import { buildThread, commentCount, type CommentNode } from '@/lib/community/logic';
import { useCommunity } from '@/lib/community/store';
import type { Sort, Vote } from '@/lib/community/types';

interface ThreadContext {
  postId: string;
  member: Member | null;
  votes: Record<string, Vote>;
  replyingTo: string | null;
  setReplyingTo: (id: string | null) => void;
  needSignIn: (what: string) => void;
}

function CommentItem({ node, ctx }: { node: CommentNode; ctx: ThreadContext }) {
  const { comment } = node;
  const replying = ctx.replyingTo === comment.id;
  return (
    <li>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <AuthorLine authorId={comment.authorId} name={comment.authorName} iso={comment.createdAt} size={28} self={ctx.member} />
        <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink">{comment.body}</p>
        <div className="mt-2 flex items-center gap-3">
          <VoteBox
            targetId={comment.id}
            baseScore={comment.score}
            mine={ctx.votes[comment.id]}
            member={ctx.member}
            onNeedSignIn={() => ctx.needSignIn('vote')}
            direction="row"
            label="this comment"
          />
          <button
            type="button"
            onClick={() => (ctx.member ? ctx.setReplyingTo(replying ? null : comment.id) : ctx.needSignIn('reply'))}
            aria-expanded={replying}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-subtle hover:bg-sunken hover:text-ink ${focusRing}`}
          >
            <CornerDownRight className="h-4 w-4" aria-hidden="true" /> Reply
          </button>
        </div>
        {replying && ctx.member && (
          <div className="mt-3">
            <CommentForm postId={ctx.postId} parentId={comment.id} member={ctx.member} autoFocus onDone={() => ctx.setReplyingTo(null)} label="Write a reply" />
          </div>
        )}
      </div>
      {node.replies.length > 0 && (
        <ul className="mt-2 space-y-2 border-l-2 border-line pl-3 sm:pl-5">
          {node.replies.map((r) => (
            <CommentItem key={r.comment.id} node={r} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** One discussion: the post, a box to comment, and the comments with their replies. */
export function PostThread({ postId }: { postId: string }) {
  const { allPosts, allComments, votes } = useCommunity();
  const { member } = useMember();
  const [sort, setSort] = useState<Sort>('top');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [gate, setGate] = useState<string | null>(null);

  const post = allPosts.find((p) => p.id === postId);
  const mineVotes = useMemo(() => (member ? votes[member.id] ?? {} : {}), [member, votes]);
  const comments = useMemo(() => allComments.filter((c) => c.postId === postId), [allComments, postId]);
  const tree = useMemo(() => buildThread(comments, sort, mineVotes), [comments, sort, mineVotes]);

  const back = (
    <Link href="/community" className={`mb-4 inline-flex items-center gap-1 rounded-sm text-[13.5px] font-medium text-subtle hover:text-ink ${focusRing}`}>
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Bantay Community
    </Link>
  );

  if (!post) {
    return (
      <>
        {back}
        <div className="rounded-3xl border border-line bg-surface p-8 text-center">
          <h1 className="text-lg font-bold text-ink">That discussion is not here</h1>
          <p className="mt-2 text-sm text-subtle">It may have been made in another browser, or the link is wrong.</p>
          <Link href="/community" className={`mt-4 inline-block rounded-sm text-sm font-semibold text-accent-ink underline ${focusRing}`}>
            See all discussions
          </Link>
        </div>
      </>
    );
  }

  const ctx: ThreadContext = { postId, member, votes: mineVotes, replyingTo, setReplyingTo, needSignIn: setGate };

  return (
    <>
      {back}
      <article className="rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="thread-title">
        <AuthorLine authorId={post.authorId} name={post.authorName} iso={post.createdAt} size={36} self={member} />
        <h1 id="thread-title" className="mt-3 text-xl font-bold leading-snug tracking-tight text-ink sm:text-2xl">{post.title}</h1>
        <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed text-ink">{post.body}</p>
        {post.project && <div className="mt-4"><ProjectChip project={post.project} /></div>}
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
          <VoteBox
            targetId={post.id}
            baseScore={post.score}
            mine={mineVotes[post.id]}
            member={member}
            onNeedSignIn={() => setGate('vote')}
            direction="row"
            label={post.title}
          />
          <span className="text-[13px] text-subtle">
            {commentCount(allComments, post.id)} {commentCount(allComments, post.id) === 1 ? 'comment' : 'comments'}
          </span>
        </div>
      </article>

      {gate && !member && <div className="mt-4"><SignInBanner what={gate} /></div>}

      <section aria-labelledby="comments-title" className="mt-6">
        <h2 id="comments-title" className="mb-3 text-base font-bold tracking-tight text-ink">Add to the discussion</h2>
        {member ? (
          <CommentForm postId={postId} parentId={null} member={member} label="Write a comment" />
        ) : (
          <button
            type="button"
            onClick={() => setGate('comment')}
            className={`w-full rounded-control border border-line-strong bg-surface p-3 text-left text-sm text-muted ${focusRing}`}
          >
            Write a comment…
          </button>
        )}

        <div className="mb-3 mt-8 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight text-ink">
            Comments <span className="font-normal text-subtle">({comments.length})</span>
          </h2>
          <SortTabs value={sort} onChange={setSort} label="Sort comments" />
        </div>

        {tree.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-subtle">No comments yet. Be the first to reply.</p>
        ) : (
          <ul className="space-y-2">
            {tree.map((n) => (
              <CommentItem key={n.comment.id} node={n} ctx={ctx} />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-[13px] text-subtle">Sample discussion by fictional people. What you write here is saved in this browser only.</p>
    </>
  );
}
