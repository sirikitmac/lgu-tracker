'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatCount } from '@/components/dpwh/format';
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-12">
      <div className="lg:col-span-5 space-y-10">
        {groups.map((group) => (
          <div key={group.name}>
            <h3 className="font-serif text-[length:var(--step-lead)] leading-tight text-night">{group.name}</h3>
            <ul className="mt-3 space-y-1">
              {group.rows.map((row) => {
                const isActive = row.region === selected;
                const code = regionCode(row.region);
                return (
                  <li key={row.region}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setSelected(isActive ? null : row.region)}
                      className={`group w-full grid grid-cols-[1fr_auto] items-baseline gap-x-4 px-3 py-2.5 text-left transition-colors duration-150 cursor-pointer focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-night ${
                        isActive ? 'bg-night text-signal' : 'text-night hover:bg-signal-tint'
                      }`}
                    >
                      <span className="text-[length:var(--step-body)] font-semibold">
                        {regionName(row.region)}
                        {code && <span className="font-normal"> · {code}</span>}
                      </span>
                      <span className="text-[length:var(--step-body)] tabular-nums font-semibold">
                        {row.contracts !== null ? formatCount(row.contracts) : ''}
                      </span>
                      {row.contracts !== null && (
                        <span
                          aria-hidden="true"
                          className={`col-span-2 mt-1.5 block h-1.5 origin-left transition-transform duration-500 ${isActive ? 'bg-signal' : 'bg-night'}`}
                          style={{ transform: `scaleX(${Math.max(0.01, row.contracts / max)})` }}
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
        <figure className="relative">
          {hasPoints ? (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full h-auto max-h-[78svh]"
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
                    fill={isActive ? '#ffffff' : '#050f16'}
                    opacity={dim ? 0.28 : 1}
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
            <div className="aspect-[76/83] bg-signal-tint flex items-center justify-center p-8 text-center text-[length:var(--step-body)] text-night">
              The map draws itself from contract locations, which could not be loaded right now.
            </div>
          )}
          {hasPoints && (
            <figcaption className="mt-4 text-[length:var(--step-small)] text-night max-w-xl">
              Each dot is one of the {pointsPerRegion} largest contracts in its region that DPWH reported
              coordinates for. The shape of the islands is drawn by the records alone.
            </figcaption>
          )}
        </figure>

        <div className="mt-8 bg-night text-white p-6 sm:p-8" aria-live="polite">
          {active && active.contracts !== null ? (
            <>
              <p className="font-serif text-[length:var(--step-head)] leading-none tabular-nums text-signal">
                {formatCount(active.contracts)}
              </p>
              <p className="mt-3 text-[length:var(--step-body)] max-w-lg">
                contracts stored for {regionName(active.region)}
                {totalContracts ? `, ${Math.round((active.contracts / totalContracts) * 100)}% of all stored contracts.` : '.'}
              </p>
              <Link
                href={directoryHref(active.region)}
                className="mt-6 inline-flex items-center gap-2 min-h-12 px-5 bg-signal text-night font-semibold text-[length:var(--step-body)] transition-colors duration-150 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                Browse {regionName(active.region)} contracts
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </Link>
            </>
          ) : hasCounts ? (
            <>
              <p className="font-serif text-[length:var(--step-head)] leading-none tabular-nums text-signal">
                {totalContracts !== null ? formatCount(totalContracts) : ''}
              </p>
              <p className="mt-3 text-[length:var(--step-body)] max-w-lg">
                DPWH contracts stored across ten regions. Choose a region to see its share and open its records.
              </p>
            </>
          ) : (
            <p className="text-[length:var(--step-body)] max-w-lg">
              Live counts are unavailable right now. The directory still lists every stored contract by region.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
