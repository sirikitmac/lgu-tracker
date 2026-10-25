'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DpwhMapPoint } from '@/types/dpwh';
import type { MapBounds } from '@/lib/integrations/dpwh/nationwide/query';
import { STATUS_COLORS, formatPeso, formatProgress, statusLabel } from './format';

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

function popupHtml(p: DpwhMapPoint): string {
  const color = STATUS_COLORS[p.status] ?? STATUS_COLORS.unknown;
  const location = [p.province, p.region].filter(Boolean).join(', ') || 'Location not reported';
  return `
    <div style="min-width:230px;max-width:280px;font-family:inherit;color:#0F172A">
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;margin-bottom:4px">
        <span style="font-family:monospace;font-weight:600;color:#172B4D">${escapeHtml(p.contract_id)}</span>
        <span style="font-weight:700;color:${color}">${escapeHtml(statusLabel(p.status))}</span>
      </div>
      <div style="font-weight:700;font-size:13px;line-height:1.35;margin-bottom:4px">${escapeHtml(p.contract_name ?? p.title)}</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:6px">${escapeHtml(location)}</div>
      <div style="font-size:12px;line-height:1.5">
        <div><span style="color:#64748B">Contract amount:</span> <strong>${escapeHtml(formatPeso(p.contract_amount))}</strong></div>
        <div><span style="color:#64748B">Reported progress:</span> <strong>${escapeHtml(formatProgress(p.progress))}</strong></div>
        <div><span style="color:#64748B">Contractor:</span> ${escapeHtml(p.contractor ?? 'Not reported')}</div>
        <div><span style="color:#64748B">Office:</span> ${escapeHtml(p.implementing_office ?? 'Not reported')}</div>
      </div>
      <a href="/projects/${encodeURIComponent(p.contract_id)}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#2563EB">View full details →</a>
      <div style="margin-top:6px;font-size:10.5px;color:#94A3B8">Coordinates as reported by DPWH; not verified.</div>
    </div>`;
}

interface Props {
  points: DpwhMapPoint[];
  /** Contract to center on and open once its marker is loaded. */
  focus: { id: string | null; lat: number; lng: number } | null;
  selectedId: string | null;
  onBoundsChange: (bounds: MapBounds) => void;
}

export default function DpwhLeafletMap({ points, focus, selectedId, onBoundsChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;
  const pendingOpenRef = useRef<string | null>(focus?.id ?? null);

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

    const resize = new ResizeObserver(() => map.invalidateSize());
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
      }
    }
    for (const p of points) {
      if (markersRef.current.has(p.contract_id)) continue;
      const color = STATUS_COLORS[p.status] ?? STATUS_COLORS.unknown;
      const marker = L.circleMarker([p.latitude, p.longitude], {
        radius: 6,
        color: '#FFFFFF',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9,
      }).bindPopup(popupHtml(p), { maxWidth: 300 });
      marker.addTo(layer);
      markersRef.current.set(p.contract_id, marker);
    }
    const pending = pendingOpenRef.current;
    if (pending && markersRef.current.has(pending)) {
      markersRef.current.get(pending)!.openPopup();
      pendingOpenRef.current = null;
    }
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 13));
    marker.openPopup();
  }, [selectedId]);

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
      className="w-full h-full min-h-[420px] rounded-xl border border-[#E2E8F0] overflow-hidden z-0"
      role="region"
      aria-label="Map of DPWH projects with reported coordinates"
    />
  );
}
