/**
 * Day and time labels for the inbox, always in Philippine time so the server
 * and the browser print the same text (no hydration mismatch).
 */
const ZONE = 'Asia/Manila';

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayName = new Intl.DateTimeFormat('en-PH', { timeZone: ZONE, weekday: 'long', month: 'short', day: 'numeric' });
const dayNameYear = new Intl.DateTimeFormat('en-PH', { timeZone: ZONE, month: 'short', day: 'numeric', year: 'numeric' });
const clock = new Intl.DateTimeFormat('en-PH', { timeZone: ZONE, hour: 'numeric', minute: '2-digit', hour12: true });
const stamp = new Intl.DateTimeFormat('en-PH', { timeZone: ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

/** "Today", "Yesterday", "Tuesday, Nov 3", or "Nov 3, 2025" for another year. */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const key = dayKey.format(date);
  if (key === dayKey.format(now)) return 'Today';
  if (key === dayKey.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  return key.slice(0, 4) === dayKey.format(now).slice(0, 4) ? dayName.format(date) : dayNameYear.format(date);
}

export const dayOf = (iso: string) => dayKey.format(new Date(iso));
export const timeLabel = (iso: string) => clock.format(new Date(iso)).replace(/\s/g, ' ');
export const stampLabel = (iso: string) => stamp.format(new Date(iso)).replace(/\s/g, ' ');

/** "just now", "5 min ago", "3 h ago", then the stamp. */
export function agoLabel(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  return stampLabel(iso);
}
