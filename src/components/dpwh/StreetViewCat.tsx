'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type L from 'leaflet';
import { ArrowLeft, Cat, Crosshair, ExternalLink, Loader2, X } from 'lucide-react';
import { errorMessage, fetchJson } from '@/lib/http';
import { useToast } from '@/components/ui/Toast';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  STREET_VIEW_RADIUS_M,
  distanceMeters,
  formatImageryDate,
  formatLatLng,
  googleMapsStreetViewUrl,
  initialHeading,
  streetViewEmbedUrl,
  type LatLng,
  type StreetViewLookup,
} from '@/lib/streetview';

/** Browser key for the Maps Embed API; without it Street View opens in Google Maps instead. */
const EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim() || '';
/** Pointer travel before a press on the cat becomes a drag rather than a click. */
const DRAG_THRESHOLD = 5;

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
const floatClass = 'glass-strong border border-line/80 shadow-raise';
const pillButton = `inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold ${focusRing}`;

/**
 * - idle: the cat waits beside the map controls.
 * - dragging: the cat follows the pointer; releasing it over the map drops it.
 * - placing: a click or tap on the map (or "Look at centre") drops it. Entered
 *   by pressing the cat, and again after a drop with no imagery, to try elsewhere.
 * - checking: asking whether Google has imagery near the drop.
 * - viewing: Street View covers the map until "Back to map".
 */
type Mode = 'idle' | 'dragging' | 'placing' | 'checking' | 'viewing';

interface View {
  drop: LatLng;
  lookup: Exclude<StreetViewLookup, { status: 'none' }>;
}

/**
 * The project map's Street View cat, after Google Maps' Pegman. It lives in
 * the map frame and works in the existing Leaflet map's coordinates; the
 * spot it is dropped on is a place, never a contract (markers stop taking
 * clicks while it is being placed, via `onPlacingChange`).
 */
export function StreetViewCat({
  map,
  onPlacingChange,
  onSpotChange,
}: {
  map: L.Map | null;
  /** True while the cat is being dragged or placed, or its drop is being checked. */
  onPlacingChange: (placing: boolean) => void;
  /** Where the cat was dropped, for a pin on the map; null when it is picked up again. */
  onSpotChange: (spot: LatLng | null) => void;
}) {
  const [mode, setMode] = useState<Mode>('idle');
  const [view, setView] = useState<View | null>(null);
  const [overMap, setOverMap] = useState(false);
  const { toast } = useToast();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const press = useRef<{ pointerId: number; x0: number; y0: number; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const request = useRef<AbortController | null>(null);

  const placing = mode === 'dragging' || mode === 'placing' || mode === 'checking';
  useEffect(() => onPlacingChange(placing), [placing, onPlacingChange]);
  useEffect(() => () => request.current?.abort(), []);

  /** The map position under a viewport point, or null over anything that is not the map itself. */
  const latLngAt = useCallback(
    (x: number, y: number): LatLng | null => {
      if (!map) return null;
      const container = map.getContainer();
      const el = document.elementFromPoint(x, y);
      // Zoom buttons and attribution sit inside the container but are not places.
      if (!el || !container.contains(el) || el.closest('.leaflet-control')) return null;
      const rect = container.getBoundingClientRect();
      const ll = map.containerPointToLatLng([x - rect.left, y - rect.top]).wrap();
      return { lat: ll.lat, lng: ll.lng };
    },
    [map]
  );

  const finish = useCallback(
    (focusCat = true) => {
      request.current?.abort();
      setMode('idle');
      setView(null);
      onSpotChange(null);
      if (focusCat) requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
    },
    [onSpotChange]
  );

  const look = useCallback(
    (drop: LatLng) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setMode('checking');
      onSpotChange(drop);
      fetchJson<StreetViewLookup>(`/api/streetview?lat=${drop.lat.toFixed(6)}&lng=${drop.lng.toFixed(6)}`, { signal: controller.signal })
        .then((lookup) => {
          if (lookup.status === 'none') {
            onSpotChange(null);
            setMode('placing');
            toast({
              id: 'street-view',
              tone: 'info',
              title: 'No Street View here',
              description: `Google has no street-level imagery within ${STREET_VIEW_RADIUS_M} m of that spot. Try a spot on or beside a road.`,
            });
            return;
          }
          setView({ drop, lookup });
          setMode('viewing');
        })
        .catch((e: unknown) => {
          if ((e as Error)?.name === 'AbortError') return;
          onSpotChange(null);
          setMode('placing');
          toast({ id: 'street-view', tone: 'error', title: 'Street View could not be opened', description: errorMessage(e) });
        });
    },
    [onSpotChange, toast]
  );

  // Placing: a click or tap on the map drops the cat there, with a crosshair cursor.
  useEffect(() => {
    if (!map || mode !== 'placing') return;
    const container = map.getContainer();
    container.classList.add('streetview-placing');
    const onClick = (e: L.LeafletMouseEvent) => {
      const ll = e.latlng.wrap();
      look({ lat: ll.lat, lng: ll.lng });
    };
    map.on('click', onClick);
    return () => {
      container.classList.remove('streetview-placing');
      map.off('click', onClick);
    };
  }, [map, mode, look]);

  // Escape backs out of whatever the cat is doing.
  useEffect(() => {
    if (mode === 'idle') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (mode === 'dragging') {
        const p = press.current;
        if (p && buttonRef.current?.hasPointerCapture(p.pointerId)) buttonRef.current.releasePointerCapture(p.pointerId);
        press.current = null;
        setOverMap(false);
      }
      finish();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, finish]);

  // Street View takes focus when it opens.
  useEffect(() => {
    if (mode === 'viewing') backRef.current?.focus({ preventScroll: true });
  }, [mode]);

  // The ghost is positioned by hand while dragging (no re-render per move); this places it on first paint.
  useLayoutEffect(() => {
    const p = press.current;
    if (mode === 'dragging' && p && ghostRef.current) ghostRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  }, [mode]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!map || e.button !== 0 || mode === 'checking' || mode === 'viewing') return;
    suppressClick.current = false;
    press.current = { pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!p.dragging) {
      if (Math.hypot(p.x - p.x0, p.y - p.y0) < DRAG_THRESHOLD) return;
      p.dragging = true;
      map?.closePopup();
      setMode('dragging');
    }
    if (ghostRef.current) ghostRef.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    const over = latLngAt(p.x, p.y) !== null;
    setOverMap((was) => (was === over ? was : over));
  };

  const endPress = (e: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    press.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!p.dragging) return; // A plain press: onClick handles it.
    suppressClick.current = true;
    setOverMap(false);
    const drop = cancelled ? null : latLngAt(e.clientX, e.clientY);
    if (drop) look(drop);
    else setMode('idle'); // Released off the map: the cat goes back to its spot.
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (mode === 'placing') finish();
    else if (mode === 'idle' && map) {
      map.closePopup();
      setMode('placing');
    }
  };

  const lookAtCentre = () => {
    if (!map) return;
    const c = map.getCenter().wrap();
    look({ lat: c.lat, lng: c.lng });
  };

  const active = mode !== 'idle';
  const label =
    mode === 'placing' ? 'Cancel Street View' : mode === 'checking' ? 'Checking for Street View…' : 'Street View: drag the cat onto the map, or press to choose a spot';

  return (
    <>
      <Tooltip content="Drag the cat onto the map to look around in Street View" side="bottom" disabled={active}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={label}
          aria-pressed={placing}
          disabled={!map || mode === 'viewing'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endPress(e, false)}
          onPointerCancel={(e) => endPress(e, true)}
          onClick={onClick}
          onContextMenu={(e) => e.preventDefault()}
          className={`streetview-cat group absolute right-3 top-[3.75rem] z-[450] grid place-items-center w-11 h-11 rounded-full touch-none select-none transition-[background-color,color,transform,box-shadow] duration-200 active:scale-95 disabled:opacity-50 ${focusRing} ${
            active ? 'bg-accent text-ink shadow-raise ring-2 ring-accent-ink/40 cursor-grabbing' : `${floatClass} text-ink hover:text-accent-ink cursor-grab`
          }`}
        >
          {mode === 'checking' ? (
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          ) : (
            <Cat className={`w-5 h-5 ${mode === 'dragging' ? 'opacity-30' : 'streetview-cat-icon'}`} aria-hidden="true" />
          )}
        </button>
      </Tooltip>

      {/* While dragging: the whole map is the drop zone, outlined; it lights up when the cat is over it. */}
      {mode === 'dragging' && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-[440] rounded-card transition-[box-shadow,background-color] duration-150 ${
            overMap ? 'shadow-[inset_0_0_0_3px_var(--color-accent)] bg-accent/5' : 'shadow-[inset_0_0_0_2px_var(--color-line-strong)]'
          }`}
        />
      )}
      {mode === 'dragging' && (
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-9 z-[455]">
          <span className={`inline-flex items-center h-9 px-3.5 rounded-full text-[13px] font-medium ${floatClass} ${overMap ? 'text-ink' : 'text-subtle'}`}>
            {overMap ? 'Let go to look around here' : 'Drag onto the map'}
          </span>
        </div>
      )}
      {mode === 'dragging' &&
        createPortal(
          // The pointer sits on the target ring under the cat: that point is the drop.
          <div ref={ghostRef} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[1000]" style={{ transform: 'translate3d(-100px,-100px,0)' }}>
            <span className={`absolute -left-3 -top-3 w-6 h-6 rounded-full border-2 ${overMap ? 'border-accent bg-accent/25' : 'border-muted bg-surface/40'}`} />
            <span
              className={`absolute -left-[1.375rem] -top-[3.75rem] grid place-items-center w-11 h-11 rounded-full bg-accent text-ink shadow-raise transition-transform duration-150 ${
                overMap ? 'scale-110 -rotate-6' : 'rotate-6'
              }`}
            >
              <Cat className="w-5 h-5" />
            </span>
          </div>,
          document.body
        )}

      {/* Placing without dragging: a crosshair at the centre for keyboard users, and the way out. */}
      {(mode === 'placing' || mode === 'checking') && (
        <>
          <Crosshair aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[440] w-7 h-7 text-ink drop-shadow-[0_0_2px_var(--color-surface)]" />
          <div role="status" className={`absolute inset-x-3 bottom-9 z-[455] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-max sm:max-w-[calc(100%-1.5rem)] rounded-2xl px-3.5 py-2.5 ${floatClass}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="flex items-center gap-2 text-[13px] text-ink min-w-0">
                {mode === 'checking' ? (
                  <>
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin text-muted" aria-hidden="true" /> Looking for Street View…
                  </>
                ) : (
                  <>
                    <Cat className="w-4 h-4 shrink-0 text-accent-ink" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">Click or tap a spot</span> to look around, or move the map and look at its centre.
                    </span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-1.5 ml-auto">
                <button type="button" onClick={lookAtCentre} disabled={mode === 'checking'} className={`${pillButton} h-8 px-3 bg-ink text-on-ink hover:bg-ink-soft disabled:opacity-50`}>
                  <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> Look at centre
                </button>
                <button type="button" onClick={() => finish()} className={`${pillButton} h-8 px-3 text-subtle hover:text-ink hover:bg-sunken`}>
                  <X className="w-3.5 h-3.5" aria-hidden="true" /> Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {mode === 'viewing' && view && <StreetViewPanel view={view} backRef={backRef} onBack={() => finish()} />}
    </>
  );
}

function StreetViewPanel({ view, backRef, onBack }: { view: View; backRef: React.Ref<HTMLButtonElement>; onBack: () => void }) {
  const { drop, lookup } = view;
  const pano = lookup.status === 'ok' ? lookup : null;
  const heading = initialHeading(drop, pano?.location ?? null);
  const where = pano?.location ?? drop;
  const external = googleMapsStreetViewUrl({ panoId: pano?.panoId, location: where, heading });
  const away = pano ? Math.round(distanceMeters(drop, pano.location)) : null;
  const date = formatImageryDate(pano?.date ?? null);
  const facts = [
    away === null ? 'Near the spot you chose' : away < 5 ? 'At the spot you chose' : `About ${away} m from the spot you chose`,
    date && `Imagery ${date}`,
  ].filter(Boolean);

  return (
    <section aria-label="Street View" className="absolute inset-0 z-[470] flex flex-col bg-surface motion-safe:animate-[tooltip-in_180ms_ease-out]">
      {/* A bar above the panorama, so nothing covers Google's own controls and attribution. */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 border-b border-line">
        <button ref={backRef} type="button" onClick={onBack} className={`${pillButton} bg-ink text-on-ink hover:bg-ink-soft`}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to map
        </button>
        <div className="min-w-0 flex-1 basis-60 text-[12.5px] leading-snug">
          <p className="flex items-center gap-1.5 text-ink">
            <Cat className="w-3.5 h-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
            <span className="font-semibold">Street View</span>
            <span className="text-subtle truncate">· {facts.join(' · ')}</span>
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            Google imagery of the place you dropped the cat ({formatLatLng(drop)}), not a view of a DPWH project, and possibly older than the work.
            {lookup.status === 'unchecked' && EMBED_KEY && ' If no imagery appears, go back and try a spot on a road.'}
          </p>
        </div>
        {EMBED_KEY && (
          <a href={external} target="_blank" rel="noopener noreferrer" className={`${pillButton} h-8 px-3 border border-line text-subtle hover:text-ink hover:bg-sunken`}>
            Google Maps <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </header>

      <div className="relative flex-1 min-h-0 bg-sunken">
        {EMBED_KEY ? (
          <iframe
            key={pano?.panoId ?? `${drop.lat},${drop.lng}`}
            title={`Google Street View near ${formatLatLng(where)}`}
            src={streetViewEmbedUrl(EMBED_KEY, { panoId: pano?.panoId, location: where, heading })}
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6">
            <div className="max-w-sm rounded-card border border-line bg-surface px-5 py-5 text-center shadow-raise">
              <Cat className="mx-auto w-6 h-6 text-accent-ink" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-ink">{pano ? 'Street View is available here' : 'Open Street View for this spot'}</p>
              <p className="mt-1 text-xs leading-relaxed text-subtle">
                Street View opens in Google Maps in a new tab.
                {!pano && ' If Google has no imagery there, it shows the map instead.'}
              </p>
              <a href={external} target="_blank" rel="noopener noreferrer" className={`${pillButton} mt-3 bg-ink text-on-ink hover:bg-ink-soft`}>
                Open in Google Maps <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
