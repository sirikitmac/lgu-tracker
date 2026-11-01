'use client';

import { useRouter } from 'next/navigation';
import { LANDING_FIXTURES, type LandingFixture } from '@/lib/landing/fixtures';

/** Dev-only switch between the real landing data and the break-ui fixtures. Rendered only in development. */
export function FixtureToggle({ current }: { current: LandingFixture }) {
  const router = useRouter();
  const pick = (value: LandingFixture) => {
    document.cookie = `landing-fixture=${value}; path=/; max-age=86400; samesite=lax`;
    router.refresh();
  };
  return (
    <div
      role="group"
      aria-label="Landing data (development only)"
      style={{ position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: '#d4d4d8', font: '12px system-ui, sans-serif' }}
    >
      {LANDING_FIXTURES.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={f === current}
          onClick={() => pick(f)}
          style={{ padding: '4px 10px', borderRadius: 999, border: 0, cursor: 'pointer', color: '#18181b', background: f === current ? '#fff' : 'transparent' }}
        >
          {f === 'demo' ? 'Demo data' : f === 'worst' ? 'Worst case' : f[0].toUpperCase() + f.slice(1)}
        </button>
      ))}
    </div>
  );
}
