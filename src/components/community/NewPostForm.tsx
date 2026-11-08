'use client';

import React, { useId, useRef, useState } from 'react';
import { controlClass, primaryButtonClass, secondaryButtonClass } from '@/components/dpwh/ui';
import { ProjectCodeFinder } from '@/components/reports/ProjectCodeFinder';
import { createPost } from '@/lib/community/live';
import { validatePost } from '@/lib/community/logic';
import { POST_LIMITS, type Post } from '@/lib/community/types';
import { recordHref } from '@/lib/reports/workflow';
import type { ReportTarget } from '@/types/report';
import type { Member } from './parts';

/** Start a discussion: a title, what you want to say, and optionally the project it is about. */
export function NewPostForm({ member, onDone }: { member: Member; onDone: (post: Post | null) => void }) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [error, setError] = useState<{ field: 'title' | 'body'; message: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const check = validatePost({ title, body });
    if (!check.ok) {
      setError({ field: check.field, message: check.error });
      (check.field === 'title' ? titleRef : bodyRef).current?.focus();
      return;
    }
    const href = target ? recordHref(target.source, target.recordId) : null;
    setFailure(null);
    setSaving(true);
    const res = await createPost({
      title,
      body,
      project: target && href ? { title: target.title, code: target.code, href } : undefined,
    });
    setSaving(false);
    if (!res.ok) return setFailure(res.error);
    onDone(res.data);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-3xl border border-line bg-surface p-5 sm:p-6" aria-label="Start a discussion">
      <h2 className="text-base font-bold tracking-tight text-ink">Start a discussion</h2>

      <div>
        <label htmlFor={`${id}-title`} className="block text-sm font-semibold text-ink">Title</label>
        <input
          id={`${id}-title`}
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={POST_LIMITS.titleMax}
          aria-invalid={error?.field === 'title' || undefined}
          aria-describedby={error?.field === 'title' ? `${id}-title-error` : undefined}
          placeholder="What do you want to talk about?"
          className={`${controlClass} mt-2 h-11`}
        />
        {error?.field === 'title' && <p id={`${id}-title-error`} role="alert" className="mt-1 text-[13px] text-danger-ink">{error.message}</p>}
      </div>

      <div>
        <label htmlFor={`${id}-body`} className="block text-sm font-semibold text-ink">Details</label>
        <textarea
          id={`${id}-body`}
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          maxLength={POST_LIMITS.bodyMax}
          aria-invalid={error?.field === 'body' || undefined}
          aria-describedby={error?.field === 'body' ? `${id}-body-error` : undefined}
          placeholder="Share what you saw or want to ask. Tagalog o English, ayos lang."
          className="mt-2 w-full rounded-control border border-line-strong bg-surface p-3 text-sm text-ink placeholder:text-muted focus:outline-2 focus:outline-accent-ink"
        />
        <div className="mt-1 flex justify-between gap-3 text-xs text-subtle">
          <span>
            {error?.field === 'body' ? (
              <span id={`${id}-body-error`} role="alert" className="text-[13px] text-danger-ink">{error.message}</span>
            ) : (
              'Please leave out phone numbers, ID numbers and accusations about named people.'
            )}
          </span>
          <span className="tabular-nums">{body.length} / {POST_LIMITS.bodyMax}</span>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">
          About a project? <span className="font-normal text-subtle">(optional)</span>
        </p>
        <p className="mt-0.5 text-xs text-subtle">Enter the project code shown under a project&apos;s title to link it.</p>
        <div className="mt-2">
          <ProjectCodeFinder id={`${id}-code`} selected={target} onSelect={setTarget} onClear={() => setTarget(null)} inputClassName={`${controlClass} h-11`} />
        </div>
      </div>

      {failure && <p role="alert" className="text-[13px] text-danger-ink">{failure}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => onDone(null)} className={secondaryButtonClass}>Cancel</button>
        <button type="submit" disabled={saving} className={`${primaryButtonClass} disabled:opacity-60`}>{saving ? 'Posting…' : 'Post discussion'}</button>
      </div>
    </form>
  );
}
