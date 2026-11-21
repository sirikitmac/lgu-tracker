'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DpwhBubble, DpwhMapPoint } from '@/types/dpwh';
import type { MapBounds } from '@/lib/integrations/dpwh/nationwide/query';
import { regionColor, regionDisplayName } from '@/lib/regionPalette';
import { statusColor, formatCount, formatPeso, formatProgress, readableTitle, statusLabel } from './format';

/** The Philippines with a little margin: [[south, west], [north, east]]. */
export const PH_MAX_BOUNDS: [[number, number], [number, number]] = [[3, 114], [22.5, 129.5]];

export type MarkerColorMode = 'status' | 'region';

const markerFill = (p: DpwhMapPoint, mode: MarkerColorMode) => (mode === 'region' ? regionColor(p.region) : statusColor(p.status));

/**
 * The selected marker grows and takes an ink ring (dark in light mode, light
 * in dark mode); a marker whose list entry is hovered or focused takes a
 * lighter version of the same ring. Fills never change.
 */
function markerRing(state: 'rest' | 'hover' | 'selected'): L.CircleMarkerOptions {
  if (state === 'rest') return { radius: 6, color: '#FFFFFF', weight: 1.5 };
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1D1D1F';
  return state === 'selected' ? { radius: 9, color: ink, weight: 3 } : { radius: 8, color: ink, weight: 2 };
}

/** Whole Philippines, the fallback view. */
const PH_CENTER: L.LatLngExpression = [12.3, 122.5];
const PH_ZOOM = 6;
/** Where the contract data is (Visayas, Mindanao and the Luzon slice): the opening view. */
const DATA_BOUNDS = L.latLngBounds([4.6, 117.4], [16.9, 126.6]);
const FOCUS_ZOOM = 15;

/** Where the Street View cat was dropped: an accent pin with a cat face, unlike any contract marker. */
const STREETVIEW_SPOT_ICON = L.divIcon({
  className: 'streetview-spot',
  iconSize: [34, 42],
  iconAnchor: [17, 41],
  html: `<svg viewBox="0 0 34 42" width="34" height="42" aria-hidden="true">
    <path d="M17 41S31 27.8 31 16.5a14 14 0 0 0-28 0C3 27.8 17 41 17 41z" fill="var(--color-accent)" stroke="#fff" stroke-width="2"/>
    <path d="M10 9.5l3.6 4.2h6.8L24 9.5l.6 7.6a7.6 7 0 0 1-15.2 0z" fill="#fff"/>
    <circle cx="14.4" cy="17.2" r="1.2" fill="#1D1D1F"/><circle cx="19.6" cy="17.2" r="1.2" fill="#1D1D1F"/>
  </svg>`,
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Hover / tap card of a bubble: how many projects, the region, and the status breakdown. */
function bubbleHtml(b: DpwhBubble, withZoom: boolean): string {
  const muted = 'color:var(--color-muted)';
  const rows = Object.entries(b.statuses)
    .sort((a, c) => c[1] - a[1])
    .map(
      ([status, count]) =>
        `<div style="display:flex;align-items:center;gap:7px;font-size:12px;line-height:1.7"><span style="width:8px;height:8px;border-radius:9999px;flex:none;background:${statusColor(status)}"></span><span style="flex:1">${escapeHtml(statusLabel(status))}</span><strong style="font-variant-numeric:tabular-nums">${formatCount(count)}</strong></div>`
    )
    .join('');
  return `
    <div style="min-width:200px;max-width:250px;font-family:inherit;color:var(--color-ink)">
      <div style="font-size:11.5px;${muted};display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="width:8px;height:8px;border-radius:2px;flex:none;background:${regionColor(b.region)}"></span>${escapeHtml(b.region ? regionDisplayName(b.region) : 'Region not reported')}</div>
      <div style="font-size:15px;font-weight:700;margin-bottom:6px;font-variant-numeric:tabular-nums">${formatCount(b.n)} project${b.n === 1 ? '' : 's'}</div>
      ${rows}
      ${withZoom ? `<button type="button" class="bubble-zoom" style="margin-top:8px;font:inherit;font-size:12px;font-weight:600;color:var(--color-accent-ink);background:none;border:0;padding:0;cursor:pointer">Zoom in →</button>` : ''}
    </div>`;
}

/** Bubble size: area follows the number of projects, relative to the busiest bubble in view (never tiny groups at full size). */
function bubbleRadius(n: number, max: number): number {
  return 7 + 31 * Math.sqrt(n / Math.max(max, 25));
}

/** Popup markup; colours are theme tokens, so it reads in light and dark. */
function popupHtml(p: DpwhMapPoint): string {
  const location = [p.province, p.region].filter(Boolean).join(', ') || 'Location not reported';
  const muted = 'color:var(--color-muted)';
  return `
    <div style="min-width:230px;max-width:280px;font-family:inherit;color:var(--color-ink)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;margin-bottom:4px">
        <span style="font-weight:600;font-variant-numeric:tabular-nums">${escapeHtml(p.contract_id)}</span>
        <span style="display:inline-flex;align-items:center;gap:5px;font-weight:600"><span style="width:8px;height:8px;border-radius:9999px;background:${statusColor(p.status)}"></span>${escapeHtml(statusLabel(p.status))}</span>
      </div>
      <div style="font-weight:600;font-size:13.5px;line-height:1.4;margin-bottom:4px">${escapeHtml(readableTitle(p.contract_name ?? p.title))}</div>
      <div style="font-size:12px;${muted};margin-bottom:6px">${escapeHtml(location)}</div>
      <div style="font-size:12px;line-height:1.5">
        <div><span style="${muted}">Contract amount:</span> <strong>${escapeHtml(formatPeso(p.contract_amount))}</strong></div>
        <div><span style="${muted}">Reported progress:</span> <strong>${escapeHtml(formatProgress(p.progress))}</strong></div>
        <div><span style="${muted}">Contractor:</span> ${escapeHtml(p.contractor ?? 'Not reported')}</div>
        <div><span style="${muted}">Office:</span> ${escapeHtml(p.implementing_office ?? 'Not reported')}</div>
      </div>
      <a href="/projects/${encodeURIComponent(p.contract_id)}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:var(--color-accent-ink)">View full details →</a>
    </div>`;
}

/**
 * The selected contract. A new object each time, so choosing the same
 * contract again (after panning away) still recenters. `pan` is false when
 * the selection came from clicking the marker itself: its popup is already
 * open and the view should not jump.
 */
export interface MapSelection {
  id: string;
  pan: boolean;
}

interface Props {
  points: DpwhMapPoint[];
  /** Contract to center on and open once its marker is loaded. */
  focus: { id: string | null; lat: number; lng: number } | null;
  selection: MapSelection | null;
  onBoundsChange: (bounds: MapBounds, zoom: number) => void;
  /** Bubbles to draw (one per area, sized by project count); empty or absent draws none. */
  bubbles?: DpwhBubble[];
  /** Called when a marker is clicked, so the list can highlight the same contract. */
  onMarkerSelect?: (id: string) => void;
  colorMode?: MarkerColorMode;
  /** Contract whose list entry is hovered or focused; its marker is emphasized. */
  hoveredId?: string | null;
  /**
   * False while the Street View cat is being placed: markers then ignore
   * clicks and hover, so a drop on top of one is read as a place on the map,
   * not as choosing that contract.
   */
  markersInteractive?: boolean;
  /** Where the Street View cat was dropped, shown as its own pin; null hides it. */
  streetViewSpot?: { lat: number; lng: number } | null;
  /** The Leaflet map once created (and null when it is removed), for overlays that work in its coordinates. */
  onMapReady?: (map: L.Map | null) => void;
}

export default function DpwhLeafletMap({ points, bubbles, focus, selection, onBoundsChange, onMarkerSelect, colorMode = 'status', hoveredId = null, markersInteractive = true, streetViewSpot = null, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const bubbleLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;
  const onMarkerSelectRef = useRef(onMarkerSelect);
  onMarkerSelectRef.current = onMarkerSelect;
  const selectedRef = useRef<string | null>(null);
  const pendingOpenRef = useRef<string | null>(focus?.id ?? null);
  const colorModeRef = useRef(colorMode);
  colorModeRef.current = colorMode;
  const pointsRef = useRef(new Map<string, DpwhMapPoint>());
  const hoveredRef = useRef<string | null>(null);
  const markersInteractiveRef = useRef(markersInteractive);
  markersInteractiveRef.current = markersInteractive;
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;
  const ringFor = (id: string) => markerRing(selectedRef.current === id ? 'selected' : hoveredRef.current === id ? 'hover' : 'rest');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    // The map stays on the Philippines: no panning out to the world, and no zooming out past the whole country.
    const map = L.map(container, {
      preferCanvas: true,
      scrollWheelZoom: true,
      minZoom: 5,
      maxBounds: PH_MAX_BOUNDS,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
    });
    if (focus) map.setView([focus.lat, focus.lng], FOCUS_ZOOM);
    // Fitting needs a laid-out container; a hidden one falls back to the whole country.
    else if (container.clientWidth > 0 && container.clientHeight > 0) map.fitBounds(DATA_BOUNDS, { padding: [12, 12] });
    else map.setView(PH_CENTER, PH_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      noWrap: true,
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · DPWH data via BetterGov.ph',
    }).addTo(map);
    bubbleLayerRef.current = L.layerGroup().addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    onMapReadyRef.current?.(map);

    const report = () => {
      // A hidden map (the list pane on a small screen) has no size and no meaningful viewport.
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      const b = map.getBounds();
      // Clamp to valid ranges; the API rejects anything outside them.
      onBoundsChangeRef.current(
        {
          west: Math.max(-180, b.getWest()),
          south: Math.max(-90, b.getSouth()),
          east: Math.min(180, b.getEast()),
          north: Math.min(90, b.getNorth()),
        },
        map.getZoom()
      );
    };
    map.on('moveend', report);
    report();

    const resize = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) map.invalidateSize();
    });
    resize.observe(container);
    return () => {
      resize.disconnect();
      onMapReadyRef.current?.(null);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      bubbleLayerRef.current = null;
      markersRef.current.clear();
    };
    // The initial view is set once; later focus changes go through selectedId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    // Diff instead of rebuilding, so a marker that stays in view (and its open
    // popup) survives the refetch that panning triggers.
    const next = new Set(points.map((p) => p.contract_id));
    for (const [id, marker] of markersRef.current) {
      if (!next.has(id)) {
        layer.removeLayer(marker);
        markersRef.current.delete(id);
        pointsRef.current.delete(id);
      }
    }
    for (const p of points) {
      if (markersRef.current.has(p.contract_id)) continue;
      const id = p.contract_id;
      const marker = L.circleMarker([p.latitude, p.longitude], {
        ...ringFor(id),
        fillColor: markerFill(p, colorModeRef.current),
        fillOpacity: 0.9,
        interactive: markersInteractiveRef.current,
      }).bindPopup(popupHtml(p), { maxWidth: 300 });
      marker.on('click', () => onMarkerSelectRef.current?.(id));
      marker.addTo(layer);
      if (selectedRef.current === id) marker.bringToFront();
      markersRef.current.set(p.contract_id, marker);
      pointsRef.current.set(p.contract_id, p);
    }
    const pending = pendingOpenRef.current;
    if (pending && markersRef.current.has(pending)) {
      markersRef.current.get(pending)!.openPopup();
      pendingOpenRef.current = null;
    }
  }, [points]);

  // Bubbles: rebuilt on every answer (a few hundred shapes at most). No numbers on them: the count is in the hover card. Biggest first, so small ones stay clickable on top.
  useEffect(() => {
    const layer = bubbleLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    const list = bubbles ?? [];
    if (list.length === 0) return;
    const max = list.reduce((m, b) => Math.max(m, b.n), 0);
    const touch = window.matchMedia('(hover: none)').matches;
    for (const b of list) {
      const r = bubbleRadius(b.n, max);
      const color = regionColor(b.region);
      const circle = L.circleMarker([b.lat, b.lng], { radius: r, color, weight: 2, opacity: 0.95, fillColor: color, fillOpacity: 0.5 });
      if (touch) {
        circle.bindPopup(bubbleHtml(b, true), { maxWidth: 260 });
        circle.on('popupopen', (e) => {
          e.popup.getElement()?.querySelector('.bubble-zoom')?.addEventListener('click', () => {
            map.closePopup();
            map.setView([b.lat, b.lng], Math.min(map.getZoom() + 2, 19));
          });
        });
      } else {
        circle.bindTooltip(bubbleHtml(b, false), { sticky: true, direction: 'auto', offset: [0, -4], opacity: 1, className: 'bubble-tip' });
        circle.on('click', () => map.setView([b.lat, b.lng], Math.min(map.getZoom() + 2, 19)));
      }
      circle.addTo(layer);
    }
  }, [bubbles]);

  // Switching between status and region colours restyles the markers in place.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const p = pointsRef.current.get(id);
      if (p) marker.setStyle({ fillColor: markerFill(p, colorMode) });
    }
  }, [colorMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !streetViewSpot) return;
    const pin = L.marker([streetViewSpot.lat, streetViewSpot.lng], {
      icon: STREETVIEW_SPOT_ICON,
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map);
    return () => {
      pin.remove();
    };
  }, [streetViewSpot]);

  // The canvas renderer reads `interactive` on every hit test, so flipping it in place is enough.
  useEffect(() => {
    for (const marker of markersRef.current.values()) marker.options.interactive = markersInteractive;
    if (!markersInteractive) mapRef.current?.closePopup();
  }, [markersInteractive]);

  useEffect(() => {
    const previous = selectedRef.current;
    selectedRef.current = selection?.id ?? null;
    if (previous && previous !== selectedRef.current) markersRef.current.get(previous)?.setStyle(ringFor(previous));
    const map = mapRef.current;
    if (!map || !selection) return;
    const marker = markersRef.current.get(selection.id);
    if (!marker) return;
    marker.setStyle(markerRing('selected')).bringToFront();
    if (!selection.pan) return;
    // The map may have been hidden behind the list on a small screen until this render.
    map.invalidateSize();
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13));
    marker.openPopup();
  }, [selection]);

  useEffect(() => {
    const previous = hoveredRef.current;
    hoveredRef.current = hoveredId;
    if (previous && previous !== hoveredId) markersRef.current.get(previous)?.setStyle(ringFor(previous));
    if (!hoveredId) return;
    const marker = markersRef.current.get(hoveredId);
    if (!marker) return;
    marker.setStyle(ringFor(hoveredId)).bringToFront();
    // The selected marker stays on top of a hovered neighbour.
    if (selectedRef.current) markersRef.current.get(selectedRef.current)?.bringToFront();
    // ringFor reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId]);

  // A new focus (e.g. "View on map" from another contract while this page is
  // open) recenters the existing map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    pendingOpenRef.current = focus.id;
    map.setView([focus.lat, focus.lng], FOCUS_ZOOM);
  }, [focus?.id, focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[420px] overflow-hidden z-0"
      role="region"
      aria-label="Map of DPWH projects with reported coordinates"
    />
  );
}
