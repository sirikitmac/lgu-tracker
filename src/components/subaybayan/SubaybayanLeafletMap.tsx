'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Supercluster, { type ClusterProperties, type PointFeature } from 'supercluster';
import { LOCATION_PRECISIONS, SUBAYBAYAN_CATEGORIES, SUBAYBAYAN_CATEGORY_COLORS, SUBAYBAYAN_CATEGORY_SHORT } from '@/lib/subaybayan/categories';
import type { PointsPayload } from '@/lib/subaybayan/query';
import { SUBAYBAYAN_MAP_ATTRIBUTION } from '@/lib/subaybayan/source';

export interface MapBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Clusters keep forming up to the map's highest zoom, so projects sharing one centroid always stay one clickable cluster. */
const MAX_ZOOM = 18;
const PH_BOUNDS = L.latLngBounds([4.4, 116.8], [21.2, 126.8]);
const BARANGAY_INDEX = LOCATION_PRECISIONS.indexOf('barangay_centroid');

type PointProps = { i: number };
type ClusterProps = { cats: number[] };

interface Props {
  points: PointsPayload | null;
  selectedId: string | null;
  /** Projects listed for one stacked location (highlighted while shown). */
  stackIds: readonly string[] | null;
  onSelect: (id: string) => void;
  /** A cluster that cannot split any further (shared centroid): its project ids. */
  onStack: (ids: string[], at: { lat: number; lng: number }) => void;
  onBoundsChange: (b: MapBounds) => void;
  /** Center on this location (a selection from the list). A new object each time recenters. */
  focus: { lat: number; lng: number; zoom?: number } | null;
}

function clusterIcon(count: number, cats: number[]): L.DivIcon {
  // Ring shows the category mix; the label is the count.
  let acc = 0;
  const total = cats.reduce((a, b) => a + b, 0) || 1;
  const stops = cats
    .map((n, i) => {
      if (!n) return null;
      const from = (acc / total) * 360;
      acc += n;
      return `${SUBAYBAYAN_CATEGORY_COLORS[SUBAYBAYAN_CATEGORIES[i]]} ${from}deg ${(acc / total) * 360}deg`;
    })
    .filter(Boolean)
    .join(', ');
  const size = count < 10 ? 30 : count < 100 ? 36 : count < 1000 ? 42 : 48;
  const label = count >= 10000 ? `${Math.round(count / 1000)}k` : count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  return L.divIcon({
    className: 'sb-cluster',
    iconSize: [size, size],
    html: `<span class="sb-cluster-ring" style="background:conic-gradient(${stops})"><span class="sb-cluster-count">${label}</span></span>`,
  });
}

function ink(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1D1D1F';
}

export default function SubaybayanLeafletMap({ points, selectedId, stackIds, onSelect, onStack, onBoundsChange, focus }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const handlers = useRef({ onSelect, onStack, onBoundsChange });
  handlers.current = { onSelect, onStack, onBoundsChange };
  const renderRef = useRef<() => void>(() => undefined);

  const index = useMemo(() => {
    if (!points) return null;
    const c = points.columns;
    const features: PointFeature<PointProps>[] = [];
    for (let i = 0; i < points.rows; i++) {
      const lat = c.lat[i];
      const lng = c.lng[i];
      if (lat === null || lng === null) continue;
      features.push({ type: 'Feature', properties: { i }, geometry: { type: 'Point', coordinates: [lng, lat] } });
    }
    const sc = new Supercluster<PointProps, ClusterProps>({
      radius: 72,
      maxZoom: MAX_ZOOM,
      map: (p) => {
        const cats = new Array(SUBAYBAYAN_CATEGORIES.length).fill(0);
        cats[c.category[p.i]] = 1;
        return { cats };
      },
      reduce: (acc, p) => {
        for (let k = 0; k < acc.cats.length; k++) acc.cats[k] += p.cats[k];
      },
    });
    sc.load(features);
    return sc;
  }, [points]);

  const highlighted = useMemo(() => new Set(stackIds ?? []), [stackIds]);

  // Map setup (once).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const map = L.map(container, { preferCanvas: true, maxZoom: MAX_ZOOM, minZoom: 5, scrollWheelZoom: true });
    if (container.clientWidth > 0 && container.clientHeight > 0) map.fitBounds(PH_BOUNDS, { padding: [8, 8] });
    else map.setView([12.3, 122.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: SUBAYBAYAN_MAP_ATTRIBUTION }).addTo(map);
    rendererRef.current = L.canvas({ padding: 0.3 });
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const report = () => {
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) return;
      const b = map.getBounds();
      handlers.current.onBoundsChange({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };
    map.on('moveend', () => {
      renderRef.current();
      report();
    });
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
    };
  }, []);

  // Draw clusters and points for the current view.
  useEffect(() => {
    renderRef.current = () => {
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;
      layer.clearLayers();
      if (!index || !points) return;
      const c = points.columns;
      const b = map.getBounds().pad(0.15);
      const zoom = Math.min(MAX_ZOOM, Math.round(map.getZoom()));
      const items = index.getClusters([Math.max(-180, b.getWest()), Math.max(-90, b.getSouth()), Math.min(180, b.getEast()), Math.min(90, b.getNorth())], zoom);
      const inkColor = ink();
      let selectedMarker: L.CircleMarker | null = null;
      for (const f of items) {
        const [lng, lat] = f.geometry.coordinates;
        const props = f.properties as ClusterProperties & ClusterProps & Partial<PointProps>;
        if (props.cluster) {
          const id = props.cluster_id;
          const marker = L.marker([lat, lng], {
            icon: clusterIcon(props.point_count, props.cats),
            keyboard: true,
            title: `${props.point_count} projects — select to zoom in`,
            riseOnHover: true,
          });
          marker.on('click', () => {
            const expansion = index.getClusterExpansionZoom(id);
            if (expansion > MAX_ZOOM) {
              const leaves = index.getLeaves(id, Infinity) as PointFeature<PointProps>[];
              handlers.current.onStack(leaves.map((l) => c.id[l.properties.i]), { lat, lng });
            } else {
              map.flyTo([lat, lng], expansion, { duration: 0.5 });
            }
          });
          marker.addTo(layer);
          continue;
        }
        const i = props.i!;
        const id = c.id[i];
        const color = SUBAYBAYAN_CATEGORY_COLORS[SUBAYBAYAN_CATEGORIES[c.category[i]]];
        const solid = c.precision[i] === BARANGAY_INDEX;
        const isSelected = id === selectedId;
        const isHighlighted = highlighted.has(id);
        const marker = L.circleMarker([lat, lng], {
          renderer: rendererRef.current ?? undefined,
          radius: isSelected ? 9 : solid ? 6 : 7,
          fillColor: color,
          fillOpacity: solid ? 0.92 : 0.18,
          color: isSelected || isHighlighted ? inkColor : solid ? '#FFFFFF' : color,
          weight: isSelected ? 3 : isHighlighted ? 2.5 : solid ? 1.5 : 2,
          dashArray: solid ? undefined : '3 3',
        });
        marker.bindTooltip(`${SUBAYBAYAN_CATEGORY_SHORT[SUBAYBAYAN_CATEGORIES[c.category[i]]]} · ${solid ? 'barangay area' : 'approximate area'}`, { direction: 'top', offset: [0, -6] });
        marker.on('click', () => handlers.current.onSelect(id));
        marker.addTo(layer);
        if (isSelected) selectedMarker = marker;
      }
      selectedMarker?.bringToFront();
    };
    renderRef.current();
  }, [index, points, selectedId, highlighted]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.invalidateSize();
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), focus.zoom ?? 13), { duration: 0.6 });
  }, [focus]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[420px] overflow-hidden z-0"
      role="region"
      aria-label="Map of DILG SubayBAYAN projects placed at area centroids"
    />
  );
}
