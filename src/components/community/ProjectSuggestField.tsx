'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Search } from 'lucide-react';
import { statusLabel } from '@/components/dpwh/format';
import {
  SUGGEST_DEBOUNCE_MS,
  rankSuggestions,
  suggestParams,
  suggestionCode,
  suggestionPlace,
  toReportTarget,
  type SuggestFilters,
} from '@/lib/community/projectSuggest';
import { PROJECT_SOURCES, isProjectSource } from '@/lib/integrations/bettergov/sources';
import { errorMessage, fetchJson } from '@/lib/http';
import type { ProjectListItem } from '@/types/dpwh';
import { DPWH_STATUSES, DPWH_STATUS_LABELS } from '@/types/dpwh';
import type { ReportTarget } from '@/types/report';

const sourceLabel = (source: string) => (isProjectSource(source) ? PROJECT_SOURCES[source].label : source);
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** Status choices for the quick filter: the directory's statuses, without "Unknown". */
const STATUS_CHOICES = DPWH_STATUSES.filter((s) => s !== 'unknown');
const AGENCY_CHOICES: { value: SuggestFilters['agency']; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DPWH', label: 'DPWH' },
  { value: 'DILG', label: 'DILG' },
];

type State = 'idle' | 'loading' | 'ready' | 'error';

/**
 * "About a project?" for a new discussion: type a project code, title or
 * place and pick from the suggestions (an ARIA 1.2 combobox with a listbox).
 * The search is the project directory's own; Source and Status narrow it.
 */
export function ProjectSuggestField({
  selected,
  onSelect,
  onClear,
  inputClassName,
}: {
  selected: ReportTarget | null;
  onSelect: (target: ReportTarget) => void;
  onClear: () => void;
  inputClassName: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<SuggestFilters>({ agency: '', status: '' });
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const params = suggestParams(text, filters)?.toString() ?? null;

  // Debounced; every new keystroke or filter aborts the request before it.
  useEffect(() => {
    if (!params) {
      setItems([]);
      setState('idle');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    const timer = window.setTimeout(() => {
      fetchJson<{ items: ProjectListItem[] }>(`/api/dpwh/contracts?${params}`, { signal: controller.signal })
        .then((body) => {
          setItems(rankSuggestions(body.items, new URLSearchParams(params).get('q') ?? ''));
          setActive(-1);
          setState('ready');
        })
        .catch((e: unknown) => {
          if ((e as Error)?.name === 'AbortError') return;
          setError(errorMessage(e, 'Could not load suggestions. Please try again.'));
          setState('error');
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [params]);

  const choose = (item: ProjectListItem) => {
    onSelect(toReportTarget(item));
    setOpen(false);
    setText('');
    setActive(-1);
  };

  if (selected) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-line bg-sunken p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
        <div className="min-w-0 flex-1" role="status">
          <p className="break-all font-mono text-sm font-semibold tabular-nums text-ink">{selected.code}</p>
          <p className="mt-0.5 break-words text-sm text-ink">{selected.title}</p>
          <p className="mt-0.5 text-xs text-muted">{sourceLabel(selected.source)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onClear();
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className={`shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-xs font-semibold text-accent-ink hover:text-ink hover:underline ${focusRing}`}
        >
          Change
        </button>
      </div>
    );
  }

  const showList = open && state !== 'idle';
  const activeId = showList && active >= 0 && active < items.length ? `${id}-opt-${active}` : undefined;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (items.length) setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (items.length) setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      // Enter picks a suggestion; it must never submit the discussion form.
      e.preventDefault();
      if (showList && active >= 0 && items[active]) choose(items[active]);
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    } else if (e.key === 'Home' || e.key === 'End') {
      setActive(-1);
    }
  };

  const announcement =
    state === 'loading'
      ? 'Searching projects'
      : state === 'error'
        ? (error ?? '')
        : state === 'ready'
          ? items.length === 0
            ? 'No match'
            : `${items.length} ${items.length === 1 ? 'suggestion' : 'suggestions'}. Use the arrow keys to choose.`
          : '';

  return (
    <div>
      <div role="group" aria-label="Narrow the suggestions" className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="inline-flex rounded-full border border-line-strong bg-surface p-0.5" role="radiogroup" aria-label="Source">
          {AGENCY_CHOICES.map((choice) => {
            const on = filters.agency === choice.value;
            return (
              <button
                key={choice.value || 'all'}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFilters((f) => ({ ...f, agency: choice.value }))}
                className={`h-8 rounded-full px-3 text-[13px] font-medium transition-colors ${focusRing} ${
                  on ? 'bg-ink text-on-ink' : 'text-subtle hover:text-ink'
                }`}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
        <label className="inline-flex min-w-0 items-center gap-2 text-[13px] text-subtle">
          Status
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className={`h-8 min-w-0 rounded-full border border-line-strong bg-surface px-2.5 text-[13px] text-ink ${focusRing}`}
          >
            <option value="">All statuses</option>
            {STATUS_CHOICES.map((s) => (
              <option key={s} value={s}>{DPWH_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
      </div>

      <label htmlFor={`${id}-input`} className="sr-only">Project code, title or place</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id={`${id}-input`}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={`${id}-hint`}
          autoComplete="off"
          spellCheck={false}
          maxLength={200}
          value={text}
          placeholder="Project code, title or place"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={`${inputClassName} w-full pl-9 pr-9`}
        />
        {state === 'loading' && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden="true" />
        )}

        <div
          hidden={!showList}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1 shadow-xl"
        >
          {/* Mouse and touch: keep focus in the input, so blur does not close the list before the pick. */}
          <ul id={listId} role="listbox" aria-label="Matching projects" onPointerDown={(e) => e.preventDefault()}>
            {state === 'ready' &&
              items.map((item, i) => {
                const place = suggestionPlace(item);
                return (
                  <li
                    key={`${item.source}|${item.record_id}`}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onClick={() => choose(item)}
                    onPointerMove={() => setActive(i)}
                    className={`cursor-pointer rounded-xl px-3 py-2.5 ${i === active ? 'bg-sunken' : ''}`}
                  >
                    <span className="block break-words text-sm font-medium text-ink">{item.title ?? item.record_id}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      <span className="font-mono tabular-nums">{suggestionCode(item)}</span>
                      {' · '}{item.agency}
                      {item.status ? ` · ${statusLabel(item.status)}` : ''}
                      {place ? ` · ${place}` : ''}
                    </span>
                  </li>
                );
              })}
          </ul>
          {state === 'loading' && <p className="px-3 py-2.5 text-sm text-muted">Searching…</p>}
          {state === 'ready' && items.length === 0 && <p className="px-3 py-2.5 text-sm text-muted">No match. Try a shorter word or clear the filters.</p>}
          {state === 'error' && <p className="px-3 py-2.5 text-sm text-danger-ink">{error}</p>}
        </div>
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
        Type at least 2 letters. The code is shown under a project&apos;s title in the directory.
      </p>
      <p className="sr-only" aria-live="polite">{open ? announcement : ''}</p>
    </div>
  );
}
