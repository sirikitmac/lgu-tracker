'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LoginPanel } from './LoginPanel';

/**
 * Sign-in as a window over whatever page the visitor is on. It is the
 * intercepted /login route (src/app/@modal/(.)login), so the page behind it
 * stays rendered, the address bar still says /login (shareable, and ?next=
 * works), and Back or Escape closes it. A native <dialog> gives the focus trap,
 * the inert background and Escape for free.
 */
export function LoginModal() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    // A modal dialog does not stop the page behind it from scrolling.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    return () => {
      root.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  const close = () => router.back();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="login-title"
      onCancel={(event) => {
        // Escape: leave through the router so the address bar goes back too.
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        // A click on the dimmed area outside the window is a click on the dialog itself.
        if (event.target === dialogRef.current) close();
      }}
      className="m-auto w-[min(56rem,calc(100vw-1.5rem))] max-w-none overflow-visible border-0 bg-transparent p-0 text-ink backdrop:bg-night/60 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-line bg-surface shadow-float motion-safe:animate-[bp-in_220ms_var(--ease-out)]">
        <LoginPanel variant="modal" onClose={close} />
      </div>
    </dialog>
  );
}
