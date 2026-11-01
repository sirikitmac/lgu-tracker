'use client';

import { useRouter } from 'next/navigation';
import { LANDING_FIXTURES, type LandingFixture } from '@/lib/landing/fixtures';

const label = (f: LandingFixture) => (f === 'demo' ? 'Demo data' : f === 'worst' ? 'Worst case' : f[0].toUpperCase() + f.slice(1));

/**
 * Dev-only switch between the real landing data and the break-ui fixtures.
 * Rendered only in development (page.tsx gates it on NODE_ENV, so production
 * builds never render it). It sits collapsed in the bottom-left corner, a
 * small chip, so it never covers the hero actions on a phone; BP's launcher
 * owns the bottom-right corner.
 */
export function FixtureToggle({ current }: { current: LandingFixture }) {
  const router = useRouter();
  const pick = (value: LandingFixture) => {
    document.cookie = `landing-fixture=${value}; path=/; max-age=86400; samesite=lax`;
    router.refresh();
  };
  return (
    <details
      data-fixture-toggle
      style={{ position: 'fixed', bottom: 8, left: 8, zIndex: 60, font: '11px system-ui, sans-serif', color: '#18181b' }}
    >
      <summary
        aria-label={`Landing data (development only): ${label(current)}`}
        style={{ cursor: 'pointer', listStyle: 'none', padding: '3px 8px', borderRadius: 999, background: 'rgb(212 212 216 / 0.85)', opacity: 0.8 }}
      >
        dev · {label(current)}
      </summary>
      <div
        role="group"
        aria-label="Landing data (development only)"
        style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, display: 'flex', flexDirection: 'column', gap: 2, padding: 3, borderRadius: 10, background: '#d4d4d8', whiteSpace: 'nowrap' }}
      >
        {LANDING_FIXTURES.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={f === current}
            onClick={() => pick(f)}
            style={{ padding: '4px 10px', borderRadius: 8, border: 0, cursor: 'pointer', textAlign: 'left', color: '#18181b', background: f === current ? '#fff' : 'transparent' }}
          >
            {label(f)}
          </button>
        ))}
      </div>
    </details>
  );
}
