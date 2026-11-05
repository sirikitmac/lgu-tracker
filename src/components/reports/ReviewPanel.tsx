'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { updateReportStatus } from '@/lib/actions/reportReview';
import { REPORT_STATUS_LABEL, REPORT_STATUS_MEANING, REVIEW_NOTE_MAX, type ReportStatus } from '@/lib/reports/workflow';

const CHOICES: ReportStatus[] = ['acknowledged', 'in_review', 'resolved', 'dismissed'];

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** Where the handler moves a report along and, if they want, writes to the sender. */
export function ReviewPanel({ reportId, status }: { reportId: string; status: ReportStatus }) {
  const router = useRouter();
  const { toast } = useToast();
  const [choice, setChoice] = useState<ReportStatus | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed = choice !== null && choice !== status;

  const save = () => {
    if (!choice || !changed) return;
    setError(null);
    startTransition(async () => {
      const res = await updateReportStatus(reportId, choice, note);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast({ tone: 'success', title: `Marked as ${REPORT_STATUS_LABEL[choice].toLowerCase()}`, description: 'The sender was notified in their inbox.' });
      setChoice(null);
      setNote('');
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="review-heading" className="rounded-3xl border border-line bg-surface p-5 shadow-raise">
      <h2 id="review-heading" className="text-base font-bold tracking-tight text-ink">Update this report</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-subtle">Every change is added to the timeline and sent to the person who reported it.</p>

      <fieldset className="mt-4">
        <legend className="sr-only">New status</legend>
        <div className="space-y-1.5">
          {CHOICES.map((value) => {
            const selected = (choice ?? status) === value;
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink ${
                  selected ? 'border-ink bg-sunken' : 'border-line hover:bg-sunken/60'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={selected}
                  onChange={() => setChoice(value)}
                  className="mt-1 h-4 w-4 accent-[var(--color-accent-ink)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {REPORT_STATUS_LABEL[value]}
                    {value === status && <span className="ml-2 text-xs font-medium text-muted">Current</span>}
                  </span>
                  <span className="block text-[13px] leading-snug text-muted">{REPORT_STATUS_MEANING[value]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="review-note" className="text-sm font-semibold text-ink">
          Message to the sender <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="review-note"
          value={note}
          maxLength={REVIEW_NOTE_MAX}
          rows={4}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What you found or what happens next"
          className="mt-1.5 w-full resize-y rounded-2xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent-ink focus:bg-surface focus:outline-2 focus:outline-offset-0 focus:outline-accent-ink"
        />
        <p className="mt-1 text-xs text-muted">They see this in their inbox and on the report. {note.length}/{REVIEW_NOTE_MAX}</p>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger-ink">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!changed || pending}
        className={`mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-on-ink transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-ink ${focusRing}`}
      >
        {pending ? 'Saving' : changed ? `Mark as ${REPORT_STATUS_LABEL[choice!].toLowerCase()}` : 'Choose a new status'}
      </button>
    </section>
  );
}
