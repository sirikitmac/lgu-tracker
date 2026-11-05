'use client';

import React, { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  BadgeCheck,
  BellRing,
  Check,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  MessageSquareText,
  Trash2,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/StateViews';
import { useToast } from '@/components/ui/Toast';
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';
import { dayLabel, dayOf, timeLabel } from '@/lib/notifications/time';
import { refreshUnread } from '@/lib/notifications/unread';
import type { AppNotification, NotificationKind } from '@/types/notification';

const KIND: Record<NotificationKind, { Icon: LucideIcon; tile: string }> = {
  report_received: { Icon: ClipboardCheck, tile: 'bg-accent-soft text-accent-ink' },
  report_new: { Icon: ClipboardList, tile: 'bg-accent-soft text-accent-ink' },
  report_update: { Icon: MessageSquareText, tile: 'bg-accent-soft text-accent-ink' },
  role_requested: { Icon: UserPlus, tile: 'bg-sunken text-ink' },
  role_decided: { Icon: BadgeCheck, tile: 'bg-sunken text-ink' },
  system: { Icon: TriangleAlert, tile: 'bg-warn-soft text-warn-ink' },
};

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

type Filter = 'all' | 'unread';

export function InboxList({ initial }: { initial: AppNotification[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<Filter>('all');
  const [, startTransition] = useTransition();

  const unread = items.filter((n) => !n.readAt).length;
  const shown = filter === 'unread' ? items.filter((n) => !n.readAt) : items;

  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; rows: AppNotification[] }> = [];
    for (const n of shown) {
      const key = dayOf(n.createdAt);
      const last = out[out.length - 1];
      if (last?.key === key) last.rows.push(n);
      else out.push({ key, label: dayLabel(n.createdAt), rows: [n] });
    }
    return out;
  }, [shown]);

  const failed = (message: string, restore: AppNotification[]) => {
    setItems(restore);
    toast({ tone: 'error', title: 'Could not update your inbox', description: message });
  };

  const markRead = (id: string) => {
    const before = items;
    const now = new Date().toISOString();
    setItems(items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n)));
    startTransition(async () => {
      const res = await markNotificationRead(id);
      if (!res.ok) failed(res.error, before);
      refreshUnread();
    });
  };

  const markAll = () => {
    const before = items;
    const now = new Date().toISOString();
    setItems(items.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    startTransition(async () => {
      const res = await markAllNotificationsRead();
      if (!res.ok) failed(res.error, before);
      else toast({ tone: 'success', title: 'Everything marked as read' });
      refreshUnread();
    });
  };

  const remove = (id: string) => {
    const before = items;
    setItems(items.filter((n) => n.id !== id));
    startTransition(async () => {
      const res = await deleteNotification(id);
      if (!res.ok) failed(res.error, before);
      refreshUnread();
    });
  };

  const tab = (value: Filter, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={filter === value}
      onClick={() => setFilter(value)}
      className={`h-9 cursor-pointer rounded-full px-4 text-[13.5px] font-medium transition-colors ${focusRing} ${
        filter === value ? 'bg-ink text-on-ink' : 'text-subtle hover:bg-sunken hover:text-ink'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filter messages" className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
          {tab('all', 'All')}
          {tab('unread', unread > 0 ? `Unread (${unread})` : 'Unread')}
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={unread === 0}
          className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 text-[13.5px] font-semibold text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-surface ${focusRing}`}
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" /> Mark all as read
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong bg-surface">
          <EmptyState
            icon={BellRing}
            title={filter === 'unread' ? 'You are all caught up' : 'Nothing here yet'}
            description={
              filter === 'unread'
                ? 'New messages appear here as soon as they arrive.'
                : 'When a report you send is reviewed, or your role changes, you will see it here.'
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">{group.label}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-raise">
                {group.rows.map((n) => {
                  const { Icon, tile } = KIND[n.kind];
                  const isUnread = !n.readAt;
                  const content = (
                    <>
                      <span aria-hidden="true" className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tile}`}>
                        <Icon className="h-[19px] w-[19px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={`break-words text-[15px] leading-snug text-ink ${isUnread ? 'font-semibold' : 'font-medium'}`}>{n.title}</span>
                          {isUnread && (
                            <>
                              <span aria-hidden="true" className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full bg-accent" />
                              <span className="sr-only">Unread</span>
                            </>
                          )}
                        </span>
                        {n.body && <span className="mt-0.5 line-clamp-3 block text-[13.5px] leading-relaxed text-subtle sm:line-clamp-2">{n.body}</span>}
                        <time dateTime={n.createdAt} className="mt-1 block text-xs text-muted sm:hidden">
                          {timeLabel(n.createdAt)}
                        </time>
                      </span>
                      <time dateTime={n.createdAt} aria-hidden="true" className="mt-1 hidden shrink-0 text-xs text-muted sm:block">
                        {timeLabel(n.createdAt)}
                      </time>
                    </>
                  );
                  const rowClass = `flex min-w-0 flex-1 basis-full items-start gap-3.5 px-4 py-3.5 text-left sm:px-5 ${focusRing} focus-visible:-outline-offset-2`;
                  return (
                    <li key={n.id} className={`group relative flex flex-wrap items-stretch ${isUnread ? 'bg-accent-soft/40' : ''}`}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => isUnread && markRead(n.id)} className={`${rowClass} hover:bg-sunken/60`}>
                          {content}
                        </Link>
                      ) : (
                        <div className={rowClass}>{content}</div>
                      )}
                      <div className="flex basis-full items-center gap-0.5 pb-2.5 pl-[3.5rem] sm:absolute sm:right-3 sm:top-2.5 sm:basis-auto sm:rounded-full sm:bg-surface sm:px-1 sm:pb-0 sm:pl-1 sm:opacity-0 sm:shadow-raise sm:ring-1 sm:ring-line sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 sm:[@media(hover:none)]:opacity-100">
                        {isUnread && (
                          <button
                            type="button"
                            onClick={() => markRead(n.id)}
                            aria-label={`Mark "${n.title}" as read`}
                            className={`grid h-9 w-9 cursor-pointer place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink ${focusRing}`}
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(n.id)}
                          aria-label={`Delete "${n.title}"`}
                          className={`grid h-9 w-9 cursor-pointer place-items-center rounded-full text-muted hover:bg-sunken hover:text-danger-ink ${focusRing}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
