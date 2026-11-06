'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Loader2, RotateCcw, Send, X } from 'lucide-react';
import { formatPeso } from '@/components/dpwh/format';
import { StatusPill } from '@/components/dpwh/StatusPill';
import { secondaryButtonClass } from '@/components/dpwh/ui';
import { Suri, SuriFace } from '@/components/suri/Suri';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tooltip } from '@/components/ui/Tooltip';

/**
 * "Ask Suri" button and Suri's chat window. Suri is Bantay Proyekto's
 * tarsier assistant. The chat is a modal dialog: the native <dialog> keeps
 * the page behind it inert, holds focus inside, closes on Escape and sits in
 * the browser's top layer, so a translucent navigation bar never gets in
 * the way. Answers come from POST /api/bp/chat; reference links are the
 * records the server actually retrieved, never parsed from the answer.
 */

interface Reference {
  source: string;
  source_label: string;
  record_id: string;
  title: string;
  href: string;
  region: string | null;
  province: string | null;
  status: string;
  status_id: string | null;
  amount_php: number | null;
  amount_label: string;
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'gemini' | 'preview';
  references?: Reference[];
}

const WELCOME =
  "Hi! I'm Suri, Bantay Proyekto's AI assistant.\n\nI help you explore infrastructure projects, understand project information and navigate public data. Ask me about amounts, locations, categories and statuses.\n\nWhat would you like to know?";

const SUGGESTIONS = [
  'How many contracts are listed in the directory?',
  'Which region has the most reported contracts?',
  'Show me road and highway projects.',
  'What is the total reported contract amount?',
  'Find projects in Iligan City.',
  'Which contracts are marked as ongoing?',
];

const STORAGE_KEY = 'lgu-tracker:bp-chat';
const MAX_INPUT = 500;

/** Minimal, safe rendering of the answer's light Markdown (paragraphs, lists, **bold**). No HTML is injected. */
function RichText({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : part
    );
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, b) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const bullets = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const numbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (lines.length && (bullets || numbered)) {
          const Tag = numbered ? 'ol' : 'ul';
          return (
            <Tag key={b} className={`${numbered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1`}>
              {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>)}
            </Tag>
          );
        }
        return (
          <p key={b}>
            {lines.map((l, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {/^#{1,6}\s/.test(l) ? <strong className="font-semibold">{l.replace(/^#{1,6}\s+/, '')}</strong> : inline(l.replace(/^\s*[-*•]\s+/, '• '))}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function ReferenceList({ references }: { references: Reference[] }) {
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs font-semibold text-muted">Records referenced</p>
      <ul className="space-y-1.5">
        {references.map((r) => (
          <li key={`${r.source}:${r.record_id}`}>
            <Link
              href={r.href}
              className="group block rounded-lg border border-line bg-surface px-3 py-2.5 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-ink"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium leading-snug text-ink group-hover:text-accent-ink line-clamp-2">{r.title}</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-muted group-hover:text-accent-ink" aria-hidden="true" />
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>{r.record_id}</span>
                {(r.province ?? r.region) && <span>{r.province ?? r.region}</span>}
                <StatusPill status={r.status_id} label={r.status} size="sm" />
                {r.amount_php !== null && <span className="tabular-nums font-medium text-ink">{formatPeso(r.amount_php)}</span>}
                <span>{r.source_label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Window event that opens Suri from anywhere on the page (the landing page's
 * "Ask Suri" card). Only the navigation's instance listens, so one chat opens;
 * `detail.from` gets the focus back when it closes.
 */
export const BP_OPEN_EVENT = 'bp:open';
export type BpOpenDetail = { from?: HTMLElement | null };

export function BpAssistant({ variant = 'button' }: { variant?: 'button' | 'nav' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const nextId = useRef(1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelId = useId();
  const titleId = useId();

  // Keep the conversation for this tab, so following a record link and coming back does not lose it.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as Message[];
      if (Array.isArray(saved) && saved.length) {
        setMessages(saved);
        nextId.current = Math.max(...saved.map((m) => m.id)) + 1;
      }
    } catch {
      // Storage unavailable or corrupt: start fresh.
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // Ignore (private mode, quota).
    }
  }, [messages]);

  // Open and close the native modal with the state, and keep the page behind from scrolling.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = before;
    };
  }, [open]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pending, error]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const close = useCallback(() => {
    setOpen(false);
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    (back?.isConnected ? back : triggerRef.current)?.focus();
  }, []);

  useEffect(() => {
    if (variant !== 'nav') return;
    const onOpen = (e: Event) => {
      returnFocusRef.current = (e as CustomEvent<BpOpenDetail>).detail?.from ?? null;
      setOpen(true);
    };
    window.addEventListener(BP_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(BP_OPEN_EVENT, onOpen);
  }, [variant]);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    if (question.length > MAX_INPUT) {
      setError(`Questions must be ${MAX_INPUT} characters or fewer.`);
      return;
    }
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { id: nextId.current++, role: 'user', content: question }]);
    setInput('');
    setError(null);
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/bp/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || typeof body.answer !== 'string') {
        throw new Error(body?.error ?? 'Suri could not answer right now. Please try again.');
      }
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: 'assistant', content: body.answer, mode: body.mode, references: Array.isArray(body.references) ? body.references : [] },
      ]);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message === 'Failed to fetch' ? 'Network error. Check your connection and try again.' : (e as Error).message);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setInput('');
    setPending(false);
    inputRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          returnFocusRef.current = null;
          if (open) close();
          else setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={variant === 'nav' ? 'Ask Suri, the AI assistant' : undefined}
        className={
          variant === 'nav'
            ? 'inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:pl-1.5 sm:pr-3.5 rounded-full border border-line-strong bg-surface text-[13px] font-semibold text-ink hover:bg-sunken transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink'
            : secondaryButtonClass
        }
      >
        <SuriFace size={22} />
        <span className={variant === 'nav' ? 'hidden sm:inline' : undefined}>Ask Suri</span>
      </button>

      <dialog
        ref={dialogRef}
        id={panelId}
        aria-labelledby={titleId}
        onClose={() => {
          // Escape or dialog.close(): bring the state and the focus back to where they were.
          if (open) close();
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) close(); // a click on the dimmed page behind
        }}
        className="m-auto w-[calc(100%-1.5rem)] max-w-xl h-[min(720px,calc(100dvh-2rem))] p-0 overflow-hidden rounded-[24px] bg-raised text-ink border border-line shadow-float backdrop:bg-night/55 backdrop:backdrop-blur-[3px] open:flex open:flex-col open:motion-safe:animate-[bp-in_220ms_var(--ease-out)]"
      >
        {open && (
          <>
          <header className="flex shrink-0 items-start gap-3 px-4 py-3 border-b border-line/80">
            <SuriFace size={40} className="mt-0.5 ring-2 ring-accent/60" />
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-base font-bold text-ink leading-tight">
                Suri <span className="font-sans text-xs font-medium text-muted">· Bantay Proyekto AI Assistant</span>
              </h2>
              <p className="text-xs text-muted">Your guide to public infrastructure data.</p>
            </div>
            <Tooltip content="New conversation" side="bottom">
              <button
                type="button"
                // Only a conversation with questions in it is worth asking about; an error alone just clears.
                onClick={() => (messages.length > 0 ? setConfirmReset(true) : reset())}
                disabled={messages.length === 0 && !error}
                className="p-2 rounded-lg text-subtle hover:bg-sunken disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-accent-ink"
                aria-label="Start a new conversation"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            </Tooltip>
            <Tooltip content="Close (Esc)" side="bottom">
              <button type="button" onClick={close} className="p-2 rounded-lg text-subtle hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent-ink" aria-label="Close Suri">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </Tooltip>
          </header>
          <ConfirmDialog
            open={confirmReset}
            onOpenChange={setConfirmReset}
            title="Start a new conversation?"
            description="This clears the questions and answers in this Suri conversation. It cannot be undone."
            confirmLabel="Clear conversation"
            tone="danger"
            onConfirm={reset}
          />

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm" aria-live="polite" aria-busy={pending}>
            <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-end sm:gap-2">
              <Suri pose="assistant" size={messages.length === 0 ? 96 : 56} className="shrink-0 transition-all" />
              <div className="max-w-full sm:max-w-[85%] rounded-2xl rounded-tl-sm sm:rounded-bl-sm sm:rounded-tl-2xl bg-surface border border-line px-3.5 py-2.5 text-ink space-y-2 leading-relaxed">
                <RichText text={WELCOME} />
              </div>
            </div>

            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Try asking:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      disabled={pending}
                      className="text-left text-xs leading-snug px-3 py-1.5 rounded-full border border-line-strong bg-surface text-ink hover:border-accent-ink hover:text-accent-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-ink px-3.5 py-2.5 text-on-ink whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              ) : (
                <div key={m.id} className="flex max-w-[95%] items-start gap-2">
                  <SuriFace size={28} className="mt-1" />
                  <div className="min-w-0">
                  <div className="rounded-2xl rounded-tl-sm bg-surface border border-line px-3.5 py-2.5 text-ink space-y-2 leading-relaxed break-words">
                    {m.mode === 'preview' && (
                      <p className="inline-block px-2 py-0.5 rounded-full border border-warn-line bg-warn-soft text-[11px] font-semibold text-warn-ink">
                        Preview mode · not AI-generated
                      </p>
                    )}
                    <RichText text={m.content} />
                  </div>
                  {m.references && m.references.length > 0 && <ReferenceList references={m.references} />}
                  <p className="mt-1.5 text-[11px] leading-snug text-muted">
                    {m.mode === 'preview'
                      ? 'Built from database results, without AI.'
                      : 'AI-generated from LGU Tracker records. Check the linked records.'}
                  </p>
                  </div>
                </div>
              )
            )}

            {pending && (
              <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm bg-sunken px-3.5 py-2.5 text-xs text-subtle" role="status">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Suri is looking up the records…
              </div>
            )}
            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 rounded-lg border border-danger-line bg-danger-soft text-xs text-danger-ink">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" /> {error}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex shrink-0 items-end gap-2 border-t border-line/80 p-3"
          >
            <label htmlFor={`${panelId}-input`} className="sr-only">Ask Suri a question</label>
            <textarea
              id={`${panelId}-input`}
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              maxLength={MAX_INPUT}
              placeholder="Ask about infrastructure projects..."
              className="flex-1 resize-none max-h-32 min-h-[40px] px-3.5 py-2 rounded-[20px] bg-surface border border-line-strong text-sm placeholder:text-muted focus:outline-2 focus:outline-offset-0 focus:outline-accent-ink field-sizing-content"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-ink text-on-ink hover:bg-ink-soft disabled:opacity-40 disabled:hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              aria-label="Send question"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
            </button>
          </form>
          <p className="shrink-0 px-4 pb-3 -mt-1 text-[11.5px] leading-snug text-muted">
            Values are as published, not verified by the LGU. Questions go to Google Gemini, so leave out personal details. Kept only in this tab.
          </p>
          </>
        )}
      </dialog>
    </>
  );
}
