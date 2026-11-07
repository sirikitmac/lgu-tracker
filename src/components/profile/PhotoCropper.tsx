'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { primaryButtonClass, secondaryButtonClass } from '@/components/dpwh/ui';
import { AVATAR_MAX_BYTES, AVATAR_SIZE } from '@/lib/profile/avatars';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centred,
  clamp,
  clampOffset,
  scaleFor,
  sourceRect,
  zoomKeepingCentre,
  type Offset,
  type View,
} from '@/lib/profile/crop';

/** Side of the square crop window on screen. Fits a 360 px wide phone with the padding around it. */
const WINDOW = 256;
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';

/**
 * A modal to frame a profile photo: drag to move, slide or scroll to zoom, then
 * "Use photo". The result is a small square JPEG, re-drawn on a canvas, which
 * also drops the location and device details stored inside the original file.
 */
export function PhotoCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; from: Offset } | null>(null);
  const titleId = useId();
  const hintId = useId();

  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);

  const view: View | null = bitmap ? { width: bitmap.width, height: bitmap.height, size: WINDOW } : null;

  // Open as a modal: the page behind is inert and Escape closes it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  // Decode the picture (turned upright from its camera orientation).
  useEffect(() => {
    let active = true;
    let made: ImageBitmap | null = null;
    createImageBitmap(file, { imageOrientation: 'from-image' }).then(
      (b) => {
        made = b;
        if (!active) return b.close();
        const v = { width: b.width, height: b.height, size: WINDOW };
        setBitmap(b);
        setZoom(1);
        setOffset(centred(v, scaleFor(v, 1)));
      },
      () => active && setProblem('This picture could not be read. Try a JPEG or PNG, or take a new photo.'),
    );
    return () => {
      active = false;
      made?.close();
    };
  }, [file]);

  // Draw the picture with the circle that will be kept.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap || !view) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = WINDOW * dpr;
    canvas.height = WINDOW * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = scaleFor(view, zoom);
    ctx.clearRect(0, 0, WINDOW, WINDOW);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, offset.x, offset.y, bitmap.width * s, bitmap.height * s);
    ctx.fillStyle = 'rgba(5, 15, 22, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, WINDOW, WINDOW);
    ctx.arc(WINDOW / 2, WINDOW / 2, WINDOW / 2 - 2, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(WINDOW / 2, WINDOW / 2, WINDOW / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }, [bitmap, view, zoom, offset]);

  const setZoomKeepingCentre = useCallback(
    (next: number) => {
      if (!view) return;
      const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
      setOffset((o) => zoomKeepingCentre(view, { scale: scaleFor(view, zoom), offset: o }, scaleFor(view, z)));
      setZoom(z);
    },
    [view, zoom],
  );

  // Scrolling over the picture zooms it. A native listener, because the page must not scroll too.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e) => {
    e.preventDefault();
    setZoomKeepingCentre(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    const onWheel = (e: WheelEvent) => wheelRef.current(e);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [bitmap]);

  const moveBy = (dx: number, dy: number) => {
    if (!view) return;
    setOffset((o) => clampOffset(view, scaleFor(view, zoom), { x: o.x + dx, y: o.y + dy }));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: offset };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !view) return;
    setOffset(clampOffset(view, scaleFor(view, zoom), { x: d.from.x + (e.clientX - d.x), y: d.from.y + (e.clientY - d.y) }));
  };
  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 32 : 12;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveBy(...moves[e.key]);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setZoomKeepingCentre(zoom * 1.1);
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setZoomKeepingCentre(zoom / 1.1);
    }
  };

  async function finish() {
    if (!bitmap || !view || working) return;
    setWorking(true);
    try {
      const { sx, sy, side } = sourceRect(view, scaleFor(view, zoom), offset);
      const out = document.createElement('canvas');
      out.width = AVATAR_SIZE;
      out.height = AVATAR_SIZE;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff'; // a transparent PNG would turn black as a JPEG
      ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      for (const quality of [0.88, 0.78, 0.65, 0.5]) {
        const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= AVATAR_MAX_BYTES) return onDone(blob);
      }
      throw new Error('size');
    } catch {
      setProblem('This browser could not prepare the photo. Try a different picture.');
      setWorking(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onCancel(); // a click on the dimmed page behind
      }}
      className="m-auto w-[min(21.5rem,calc(100vw-1.5rem))] rounded-3xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-night/60 backdrop:backdrop-blur-sm"
    >
      <h2 id={titleId} className="text-base font-bold tracking-tight">
        Frame your photo
      </h2>

      {problem ? (
        <>
          <p role="alert" className="mt-3 text-sm text-danger-ink">
            {problem}
          </p>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onCancel} className={secondaryButtonClass}>
              Close
            </button>
          </div>
        </>
      ) : (
        <>
          <p id={hintId} className="mt-1 text-[13px] leading-relaxed text-subtle">
            Drag to move. Use the slider or scroll to zoom. The circle is what people will see.
          </p>

          <div className="mt-4 grid place-items-center">
            {bitmap ? (
              <canvas
                ref={canvasRef}
                role="img"
                tabIndex={0}
                aria-label="Photo crop. Drag to move it, arrow keys to move, plus and minus to zoom."
                aria-describedby={hintId}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onKeyDown}
                style={{ width: WINDOW, height: WINDOW, touchAction: 'none' }}
                className={`cursor-grab rounded-2xl bg-sunken active:cursor-grabbing ${focusRing}`}
              />
            ) : (
              <div style={{ width: WINDOW, height: WINDOW }} className="grid place-items-center rounded-2xl bg-sunken text-sm text-subtle" role="status">
                Opening your photo…
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoomKeepingCentre(zoom / 1.2)}
              disabled={!bitmap || zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-ink hover:bg-sunken disabled:opacity-40 ${focusRing}`}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={!bitmap}
              onChange={(e) => setZoomKeepingCentre(Number(e.target.value))}
              aria-label="Zoom"
              className="h-9 w-full accent-[var(--color-accent-ink,#FF7A1F)]"
            />
            <button
              type="button"
              onClick={() => setZoomKeepingCentre(zoom * 1.2)}
              disabled={!bitmap || zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-ink hover:bg-sunken disabled:opacity-40 ${focusRing}`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="button" onClick={finish} disabled={!bitmap || working} className={`${primaryButtonClass} disabled:opacity-60`}>
              {working ? 'Preparing…' : 'Use photo'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
