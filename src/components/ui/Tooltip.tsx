'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A short hint for a control whose purpose is not obvious from its face.
 * Opens on hover (after a brief delay) and on keyboard focus, closes on
 * Escape, blur, scroll, or when the pointer leaves both the control and the
 * hint (so the hint itself can be hovered). Rendered into <body> with fixed
 * positioning, above the trigger by default, flipped below when there is no
 * room, and kept inside the viewport.
 *
 * On touch screens a tap on the control toggles the hint. It is linked with
 * aria-describedby while open. Never put the only copy of essential
 * instructions in a tooltip, and give icon-only buttons an aria-label too.
 */

const OPEN_DELAY = 350;
const CLOSE_DELAY = 120;
const GAP = 8;
const EDGE = 8;

type TriggerProps = {
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  onPointerEnter?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<HTMLElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
  'aria-describedby'?: string;
};

export function Tooltip({
  content,
  children,
  side = 'top',
  disabled = false,
}: {
  content: React.ReactNode;
  /** One element that can take focus (a button, link or input). */
  children: React.ReactElement<TriggerProps>;
  side?: 'top' | 'bottom';
  /** Suppresses the hint, e.g. while the menu the control opens is showing. */
  disabled?: boolean;
}) {
  const id = useId();
  const [shown, setOpen] = useState(false);
  const open = shown && !disabled;
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointer = useRef<string>('mouse');

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback((delay: number) => {
    clear();
    timer.current = setTimeout(() => setOpen(true), delay);
  }, []);
  const hide = useCallback((delay: number) => {
    clear();
    timer.current = setTimeout(() => {
      setOpen(false);
      setPosition(null);
    }, delay);
  }, []);
  useEffect(() => clear, []);
  useEffect(() => {
    if (!disabled) return;
    clear();
    setOpen(false);
  }, [disabled]);

  // Measure after the hint renders (invisible) so its real size decides the placement.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const above = t.top - GAP - tip.height;
    const below = t.bottom + GAP;
    const top = side === 'top' ? (above >= EDGE ? above : below) : below + tip.height <= vh - EDGE ? below : above;
    const left = Math.min(Math.max(EDGE, t.left + t.width / 2 - tip.width / 2), vw - tip.width - EDGE);
    setPosition({ top: Math.max(EDGE, top), left });
  }, [open, side, content]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide(0);
    const onScroll = () => hide(0);
    // A tap elsewhere closes a hint opened by tapping.
    const onOutside = (e: PointerEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !tipRef.current?.contains(e.target as Node)) hide(0);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, hide]);

  const own = children.props;
  const trigger = React.cloneElement(children, {
    onPointerDown: (e) => {
      own.onPointerDown?.(e);
      lastPointer.current = e.pointerType;
    },
    onClick: (e) => {
      own.onClick?.(e);
      // Touch screens have no hover: a tap toggles the hint (the control still acts as usual).
      if (lastPointer.current !== 'touch' || e.detail === 0) return;
      triggerRef.current = e.currentTarget;
      clear();
      setOpen((o) => !o);
    },
    onPointerEnter: (e) => {
      own.onPointerEnter?.(e);
      // Touch "hover" is a tap: the control acts, no hint.
      if (e.pointerType === 'touch') return;
      triggerRef.current = e.currentTarget;
      show(OPEN_DELAY);
    },
    onPointerLeave: (e) => {
      own.onPointerLeave?.(e);
      hide(CLOSE_DELAY);
    },
    onFocus: (e) => {
      own.onFocus?.(e);
      // Keyboard focus only: a mouse click that focuses a button should not pop a hint.
      if (!e.currentTarget.matches(':focus-visible')) return;
      triggerRef.current = e.currentTarget;
      show(0);
    },
    onBlur: (e) => {
      own.onBlur?.(e);
      hide(0);
    },
    'aria-describedby': open ? [own['aria-describedby'], id].filter(Boolean).join(' ') : own['aria-describedby'],
  });

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            onPointerEnter={clear}
            onPointerLeave={() => hide(CLOSE_DELAY)}
            style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, visibility: 'hidden' }}
            className="fixed z-[1300] max-w-[min(18rem,calc(100vw-1rem))] px-2.5 py-1.5 rounded-lg bg-ink text-on-ink text-xs font-medium leading-snug shadow-float motion-safe:animate-[tooltip-in_120ms_var(--ease-out)]"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
