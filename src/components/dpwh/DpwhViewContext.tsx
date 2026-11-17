'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DpwhMapPoint } from '@/types/dpwh';
import type { MarkerColorMode } from './DpwhLeafletMap';
import {
  EMPTY_VIEW_FILTERS,
  sameViewFilters,
  searchWithViewFilters,
  toggleViewFilter,
  type FilterOrigin,
  type ViewFilters,
} from '@/lib/dpwh/viewFilters';

/** How many contracts match the filters across the whole map, as counted by the map's own API. */
export interface MatchingCount {
  total: number | null;
  state: 'loading' | 'ready' | 'error';
}

interface DpwhView {
  filters: ViewFilters;
  /** Replace the shared filters. A change that comes from the dashboard also asks the map to zoom to the result. */
  setFilters: (next: ViewFilters, origin: FilterOrigin) => void;
  /** Select one value of a filter (the same value again clears it). */
  toggle: (key: keyof ViewFilters, value: string | null, origin: FilterOrigin) => void;
  clear: (origin: FilterOrigin) => void;
  /** Bumped when the dashboard changed the filters: the map frames the result. */
  fitRequest: number;
  /** The contract selected on the map (a marker or a list card), shown on the dashboard. */
  selected: DpwhMapPoint | null;
  setSelected: (point: DpwhMapPoint | null) => void;
  /** What the map colours its dots by. The dashboard drives it: region bars colour by region, the status donut by status. */
  colorMode: MarkerColorMode;
  setColorMode: (mode: MarkerColorMode) => void;
  matching: MatchingCount;
  setMatching: (m: MatchingCount) => void;
}

const Ctx = createContext<DpwhView | null>(null);

/**
 * One set of filters for the map and the dashboard on the same page, so
 * whatever is clicked on one is reflected on the other. `mirror` keeps the
 * filters in the address bar (only for the DPWH layer: the SubayBAYAN layer
 * uses the same parameter names for its own filters).
 */
export function DpwhViewProvider({ initial, mirror, children }: { initial: ViewFilters; mirror: boolean; children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<ViewFilters>(initial);
  const [fitRequest, setFitRequest] = useState(0);
  const [selected, setSelected] = useState<DpwhMapPoint | null>(null);
  const [colorMode, setColorMode] = useState<MarkerColorMode>('region');
  const [matching, setMatching] = useState<MatchingCount>({ total: null, state: 'loading' });
  const current = useRef(filters);
  current.current = filters;

  const setFilters = useCallback((next: ViewFilters, origin: FilterOrigin) => {
    if (sameViewFilters(next, current.current)) return;
    setFiltersState(next);
    if (origin === 'dashboard') {
      setFitRequest((n) => n + 1);
      // A status picked on the dashboard shows the map in status colours; clearing it goes back to region colours.
      if (next.status !== current.current.status) setColorMode(next.status ? 'status' : 'region');
      else if (next.region !== current.current.region && next.region) setColorMode('region');
    }
  }, []);

  const toggle = useCallback(
    (key: keyof ViewFilters, value: string | null, origin: FilterOrigin) => setFilters(toggleViewFilter(current.current, key, value), origin),
    [setFilters]
  );
  const clear = useCallback((origin: FilterOrigin) => setFilters(EMPTY_VIEW_FILTERS, origin), [setFilters]);

  // Keep the filters in the address bar so the view can be shared.
  useEffect(() => {
    if (!mirror) return;
    const search = searchWithViewFilters(window.location.search, filters);
    const url = `${window.location.pathname}${search}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, '', url);
  }, [filters, mirror]);

  const value = useMemo<DpwhView>(
    () => ({ filters, setFilters, toggle, clear, fitRequest, selected, setSelected, colorMode, setColorMode, matching, setMatching }),
    [filters, setFilters, toggle, clear, fitRequest, selected, colorMode, matching]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDpwhView(): DpwhView {
  const value = useContext(Ctx);
  if (!value) throw new Error('useDpwhView must be used inside <DpwhViewProvider>.');
  return value;
}
