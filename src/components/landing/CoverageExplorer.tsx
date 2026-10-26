'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatCount } from '@/components/dpwh/format';
import { regionColor } from '@/lib/regionPalette';
import { regionCode, regionName } from './content';

interface RegionRow {
  region: string;
  contracts: number | null;
  points: [number, number][];
}

/** Map frame in degrees: the Visayas and Mindanao, Sulu and Tawi-Tawi included. */
const WEST = 119.3;
const EAST = 126.9;
const NORTH = 12.7;
const SOUTH = 4.4;
const SCALE = 100;
const WIDTH = (EAST - WEST) * SCALE;
const HEIGHT = (NORTH - SOUTH) * SCALE;

const VISAYAS = new Set(['Region VI', 'Region VII', 'Region VIII', 'Negros Island Region']);

function directoryHref(region: string) {
  return `/projects?${new URLSearchParams({ region, source: 'dpwh_contracts' })}`;
}

export function CoverageExplorer({
  regions,
  totalContracts,
  pointsPerRegion,
}: {
  regions: RegionRow[];
  totalContracts: number | null;
  pointsPerRegion: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const hasCounts = regions.some((r) => r.contracts !== null);
  const hasPoints = regions.some((r) => r.points.length > 0);
  const max = Math.max(1, ...regions.map((r) => r.contracts ?? 0));
  const active = regions.find((r) => r.region === selected) ?? null;

  const groups = [
    { name: 'Visayas', rows: regions.filter((r) => VISAYAS.has(r.region)) },
    { name: 'Mindanao', rows: regions.filter((r) => !VISAYAS.has(r.region)) },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-6 gap-y-4">
      <div className="lg:col-span-5 space-y-8 rounded-[24px] bg-surface p-4 sm:p-6 self-start">
        {groups.map((group) => (
          <div key={group.name}>
            <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{group.name}</h3>
            <ul className="mt-2 space-y-0.5">
              {group.rows.map((row) => {
                const isActive = row.region === selected;
                const code = regionCode(row.region);
                return (
                  <li key={row.region}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setSelected(isActive ? null : row.region)}
                      className={`group w-full grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-3 py-2.5 rounded-xl text-left text-ink transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink ${
                        isActive ? 'bg-surface shadow-raise ring-1 ring-line-strong' : 'hover:bg-sunken'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-[15px] font-semibold">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: regionColor(row.region) }} aria-hidden="true" />
                        <span>
                          {regionName(row.region)}
                          {code && <span className="font-normal text-muted"> · {code}</span>}
                        </span>
                      </span>
                      <span className="text-[15px] tabular-nums font-semibold">
                        {row.contracts !== null ? formatCount(row.contracts) : ''}
                      </span>
                      {row.contracts !== null && (
                        <span
                          aria-hidden="true"
                          className="col-span-2 mt-1.5 block h-1.5 rounded-full origin-left transition-transform duration-500"
                          style={{ transform: `scaleX(${Math.max(0.01, row.contracts / max)})`, backgroundColor: regionColor(row.region) }}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="lg:col-span-7 flex flex-col">
        <figure className="relative rounded-[24px] border border-line bg-surface p-4 sm:p-6">
          {hasPoints ? (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full h-auto max-h-[70svh]"
              role="img"
              aria-label={
                active
                  ? `Map of the Visayas and Mindanao with the largest mapped contracts in ${regionName(active.region)} highlighted`
                  : 'Map of the Visayas and Mindanao drawn from the locations of the largest mapped contracts in each region'
              }
            >
              {regions.map((row) => {
                const isActive = row.region === selected;
                const dim = selected !== null && !isActive;
                return (
                  <g
                    key={row.region}
                    className="transition-opacity duration-300"
                    fill={regionColor(row.region)}
                    opacity={dim ? 0.15 : 0.9}
                  >
                    {row.points.map(([lon, lat], i) => (
                      <circle
                        key={i}
                        cx={((lon - WEST) * SCALE).toFixed(1)}
                        cy={((NORTH - lat) * SCALE).toFixed(1)}
                        r={isActive ? 5 : 3.4}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="aspect-[76/83] rounded-2xl bg-sunken flex items-center justify-center p-8 text-center text-[15px] text-subtle">
              The map draws itself from contract locations, which could not be loaded right now.
            </div>
          )}
          {hasPoints && (
            <figcaption className="mt-4 text-[13px] text-muted max-w-xl">
              Each dot is one of the {pointsPerRegion} largest contracts in its region that DPWH reported
              coordinates for. The shape of the islands is drawn by the records alone.
            </figcaption>
          )}
        </figure>

        <div className="mt-4 rounded-[24px] border border-line bg-surface p-6 sm:p-7" aria-live="polite">
          {active && active.contracts !== null ? (
            <>
              <p className="font-display text-[length:var(--step-head)] leading-none tabular-nums text-ink">
                {formatCount(active.contracts)}
              </p>
              <p className="mt-2 text-[15px] text-subtle max-w-lg">
                contracts stored for {regionName(active.region)}
                {totalContracts ? `, ${Math.round((active.contracts / totalContracts) * 100)}% of all stored contracts.` : '.'}
              </p>
              <Link
                href={directoryHref(active.region)}
                className="mt-5 inline-flex items-center gap-2 min-h-11 px-5 rounded-full bg-ink text-on-ink font-semibold text-[15px] transition-colors duration-150 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              >
                Browse {regionName(active.region)} contracts
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </>
          ) : hasCounts ? (
            <>
              <p className="font-display text-[length:var(--step-head)] leading-none tabular-nums text-ink">
                {totalContracts !== null ? formatCount(totalContracts) : ''}
              </p>
              <p className="mt-2 text-[15px] text-subtle max-w-lg">
                DPWH contracts stored across ten regions. Choose a region to see its share and open its records.
              </p>
            </>
          ) : (
            <p className="text-[15px] text-subtle max-w-lg">
              Live counts are unavailable right now. The directory still lists every stored contract by region.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
