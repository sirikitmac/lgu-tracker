'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { primaryButtonClass, secondaryButtonClass } from '@/components/dpwh/ui';
import { newId, validateComment } from '@/lib/community/logic';
import { addComment } from '@/lib/community/store';
import { POST_LIMITS } from '@/lib/community/types';
import type { Member } from './parts';

/** Write a comment on the post (parentId null) or a reply to another comment. */
export function CommentForm({
  postId,
  parentId,
  member,
  onDone,
  autoFocus = false,
  label,
}: {
  postId: string;
  parentId: string | null;
  member: Member;
  onDone?: () => void;
  autoFocus?: boolean;
  label: string;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const check = validateComment(text);
    if (!check.ok) {
      setError(check.error);
      ref.current?.focus();
      return;
    }
    addComment({
      id: newId('c'),
      postId,
      parentId,
      authorId: member.id,
      authorName: member.name,
      body: text.trim(),
      createdAt: new Date().toISOString(),
      score: 0,
    });
    setText('');
    setError(null);
    onDone?.();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor={id} className="sr-only">{label}</label>
      <textarea
        id={id}
        ref={ref}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        rows={parentId ? 3 : 4}
        maxLength={POST_LIMITS.commentMax}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder={label}
        className="w-full rounded-control border border-line-strong bg-surface p-3 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-accent-ink"
      />
      <div className="flex items-center justify-between gap-3">
        <p id={`${id}-error`} role="alert" className="text-[13px] text-danger-ink">{error}</p>
        <div className="flex gap-2">
          {onDone && <button type="button" onClick={onDone} className={secondaryButtonClass}>Cancel</button>}
          <button type="submit" className={primaryButtonClass}>{parentId ? 'Reply' : 'Comment'}</button>
        </div>
      </div>
    </form>
  );
}
