'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DpwhMapPoint } from '@/types/dpwh';
import type { MapBounds } from '@/lib/integrations/dpwh/nationwide/query';
import { regionColor } from '@/lib/regionPalette';
import { statusColor, formatPeso, formatProgress, readableTitle, statusLabel } from './format';

export type MarkerColorMode = 'status' | 'region';

const markerFill = (p: DpwhMapPoint, mode: MarkerColorMode) => (mode === 'region' ? regionColor(p.region) : statusColor(p.status));

/** The selected marker grows and takes an ink ring (dark in light mode, light in dark mode); fills never change. */
function markerRing(selected: boolean): L.CircleMarkerOptions {
  if (!selected) return { radius: 6, color: '#FFFFFF', weight: 1.5 };
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1D1D1F';
  return { radius: 9, color: ink, weight: 3 };
}

/** Whole Philippines. */
const PH_CENTER: L.LatLngExpression = [12.3, 122.5];
const PH_ZOOM = 6;
const FOCUS_ZOOM = 15;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
      <div style="margin-top:6px;font-size:10.5px;${muted}">Coordinates as reported by DPWH; not verified.</div>
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
  onBoundsChange: (bounds: MapBounds) => void;
  /** Called when a marker is clicked, so the list can highlight the same contract. */
  onMarkerSelect?: (id: string) => void;
  colorMode?: MarkerColorMode;
}

export default function DpwhLeafletMap({ points, focus, selection, onBoundsChange, onMarkerSelect, colorMode = 'status' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: focus ? [focus.lat, focus.lng] : PH_CENTER,
      zoom: focus ? FOCUS_ZOOM : PH_ZOOM,
      preferCanvas: true,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · DPWH data via BetterGov.ph',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const report = () => {
      // A hidden map (the list pane on a small screen) has no size and no meaningful viewport.
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      const b = map.getBounds();
      // Clamp to valid ranges; the API rejects anything outside them.
      onBoundsChangeRef.current({
        west: Math.max(-180, b.getWest()),
        south: Math.max(-90, b.getSouth()),
        east: Math.min(180, b.getEast()),
        north: Math.min(90, b.getNorth()),
      });
    };
    map.on('moveend', report);
    report();

    const resize = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) map.invalidateSize();
    });
    resize.observe(container);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
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
        ...markerRing(selectedRef.current === id),
        fillColor: markerFill(p, colorModeRef.current),
        fillOpacity: 0.9,
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

  // Switching between status and region colours restyles the markers in place.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const p = pointsRef.current.get(id);
      if (p) marker.setStyle({ fillColor: markerFill(p, colorMode) });
    }
  }, [colorMode]);

  useEffect(() => {
    const previous = selectedRef.current;
    selectedRef.current = selection?.id ?? null;
    if (previous && previous !== selectedRef.current) markersRef.current.get(previous)?.setStyle(markerRing(false));
    const map = mapRef.current;
    if (!map || !selection) return;
    const marker = markersRef.current.get(selection.id);
    if (!marker) return;
    marker.setStyle(markerRing(true)).bringToFront();
    if (!selection.pan) return;
    // The map may have been hidden behind the list on a small screen until this render.
    map.invalidateSize();
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13));
    marker.openPopup();
  }, [selection]);

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
