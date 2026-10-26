'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import {
  readThemePreference,
  resolveTheme,
  setThemePreference,
  watchSystemTheme,
  type ThemePreference,
} from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'Match system', Icon: Monitor },
];

/** Keeps a component in step with the saved preference across tabs and toggles. */
function useThemePreference() {
  // Light on the server and the first client render, matching the markup;
  // the effect then reads the real preference (the inline script has already
  // painted the right theme, so only the icon updates).
  const [preference, setPreference] = useState<ThemePreference>('light');
  useEffect(() => {
    const sync = () => setPreference(readThemePreference());
    sync();
    window.addEventListener('lgu-theme-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('lgu-theme-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  useEffect(() => {
    if (preference !== 'system') return;
    return watchSystemTheme(() => document.documentElement.setAttribute('data-theme', resolveTheme('system')));
  }, [preference]);
  return preference;
}

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/** Navigation-bar control: an icon button that opens a three-option menu. */
export function ThemeToggle() {
  const preference = useThemePreference();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const items = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    items().find((el) => el.getAttribute('aria-checked') === 'true')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
      } else if (e.key === 'Tab') {
        setOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const choose = (value: ThemePreference) => {
    setThemePreference(value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Theme: ${current.label}`}
        title="Change theme"
        className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-subtle hover:text-ink hover:bg-sunken transition-colors ${focusRing}`}
      >
        <current.Icon className="w-[18px] h-[18px]" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Theme"
          className="absolute right-0 top-full mt-2 w-44 p-1 rounded-xl bg-raised border border-line shadow-float z-50 motion-safe:animate-[bp-in_160ms_var(--ease-out)]"
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === value}
              onClick={() => choose(value)}
              className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm text-ink hover:bg-sunken focus-visible:bg-sunken focus-visible:outline-none"
            >
              <Icon className="w-4 h-4 text-muted" aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {preference === value && <Check className="w-4 h-4 text-ink" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mobile-menu variant: the same three choices as a segmented control. */
export function ThemeSegmented() {
  const preference = useThemePreference();
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 p-1 rounded-full bg-sunken">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          onClick={() => setThemePreference(value)}
          className={`inline-flex items-center justify-center gap-1.5 h-9 rounded-full text-[13px] font-medium transition-colors ${focusRing} ${
            preference === value ? 'bg-surface text-ink shadow-raise' : 'text-subtle hover:text-ink'
          }`}
        >
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
          {value === 'system' ? 'System' : label}
        </button>
      ))}
    </div>
  );
}
