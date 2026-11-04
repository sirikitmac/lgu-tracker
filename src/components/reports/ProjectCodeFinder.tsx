'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Search } from 'lucide-react';
import { lookupProjectByCode } from '@/lib/actions/reports';
import { PROJECT_SOURCES, isProjectSource } from '@/lib/integrations/bettergov/sources';
import type { ReportTarget } from '@/types/report';

const sourceLabel = (source: string) => (isProjectSource(source) ? PROJECT_SOURCES[source].label : source);

/**
 * "Project code" for the report form: type the code the directory shows under
 * a project's title, press Find (or Enter), and confirm the project it points
 * to. Used by the login window (before sign-in) and by the report form when it
 * was not opened from a project. Looking a code up needs no account.
 */
export function ProjectCodeFinder({
  id,
  selected,
  onSelect,
  onClear,
  initialCode = '',
  autoFocus = false,
  error,
  inputClassName,
}: {
  id: string;
  selected: ReportTarget | null;
  onSelect: (target: ReportTarget) => void;
  onClear: () => void;
  /** Looked up once on mount, e.g. a code in the link someone followed. */
  initialCode?: string;
  autoFocus?: boolean;
  /** An error from the form that holds this field (nothing chosen yet). */
  error?: string | null;
  inputClassName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [choices, setChoices] = useState<ReportTarget[]>([]);

  const find = async (value: string) => {
    if (busy) return;
    setMessage(null);
    setChoices([]);
    if (!value.trim()) {
      setMessage('Enter the project code first.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await lookupProjectByCode(value);
      if (!result.ok) {
        setMessage(result.error);
      } else if (result.data.matches.length === 0) {
        setMessage('No project has that code. Check it against the project page and try again.');
      } else if (result.data.matches.length === 1) {
        onSelect(result.data.matches[0]);
      } else {
        setChoices(result.data.matches);
      }
    } catch {
      setMessage('Could not look that up. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void (initialCode && !selected && find(initialCode)), []);

  if (selected) {
    return (
      <div>
        <p className="block text-xs font-semibold text-ink mb-1.5">Project code</p>
        <div className="flex items-start gap-3 rounded-xl border border-line bg-sunken p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
          <div className="min-w-0 flex-1" role="status">
            <p className="break-all font-mono text-sm font-semibold tabular-nums text-ink">{selected.code}</p>
            <p className="mt-0.5 break-words text-sm text-ink">{selected.title}</p>
            <p className="mt-0.5 text-xs text-muted">{sourceLabel(selected.source)}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-semibold text-accent-ink hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent-ink"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const shown = message ?? error ?? null;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink mb-1.5">
        Project code
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={code}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={80}
          placeholder="e.g. LIME-25-13-02-00-000-41"
          onChange={(e) => {
            setCode(e.target.value);
            if (message) setMessage(null);
          }}
          // Enter looks the code up; it must not submit the form this sits in.
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void find(code);
            }
          }}
          aria-invalid={shown ? true : undefined}
          aria-describedby={`${id}-hint${shown ? ` ${id}-error` : ''}`}
          className={`${inputClassName} min-w-0 flex-1 font-mono`}
        />
        <button
          type="button"
          onClick={() => void find(code)}
          disabled={busy}
          className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          Find
        </button>
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
        It is shown under the project&apos;s title in the directory.
      </p>
      {shown && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-danger-ink">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {shown}
        </p>
      )}
      {choices.length > 1 && (
        <ul className="mt-2 space-y-1.5" aria-label="Projects with that code">
          {choices.map((choice) => (
            <li key={`${choice.source}|${choice.recordId}`}>
              <button
                type="button"
                onClick={() => {
                  setChoices([]);
                  onSelect(choice);
                }}
                className="w-full cursor-pointer rounded-xl border border-line p-3 text-left transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent-ink"
              >
                <span className="block break-words text-sm font-medium text-ink">{choice.title}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  <span className="font-mono tabular-nums">{choice.code}</span> · {sourceLabel(choice.source)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
