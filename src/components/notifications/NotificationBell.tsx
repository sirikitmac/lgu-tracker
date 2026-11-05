'use client';

import React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/lib/notifications/unread';

/** The bell in the top bar: a link to the inbox with the unread count. */
export function NotificationBell({ className = '', label = false }: { className?: string; label?: boolean }) {
  const unread = useUnreadCount();
  const text = unread > 0 ? `Inbox, ${unread} unread` : 'Inbox';
  return (
    <Link
      href="/inbox"
      aria-label={text}
      className={`relative inline-flex items-center justify-center gap-2 rounded-full text-ink transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink ${
        label ? 'w-full min-h-11 border border-line-strong bg-surface text-sm font-semibold' : 'h-9 w-9'
      } ${className}`}
    >
      <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
      {label && <span>Inbox</span>}
      {unread > 0 && (
        <span
          aria-hidden="true"
          className={`grid min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-[18px] text-night ${
            label ? '' : 'absolute -right-0.5 -top-0.5'
          }`}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
