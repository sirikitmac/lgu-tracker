import React from 'react';
import { resolveAuthor } from '@/lib/community/profiles';
import type { Profile } from '@/lib/community/types';

/** Background and figure colours, all from the brand's orange and night. */
const TONES: readonly [string, string][] = [
  ['#FF7A1F', '#050F16'],
  ['#FFD2B0', '#050F16'],
  ['#050F16', '#FF9A55'],
  ['#3A2213', '#FFD2B0'],
  ['#FFE4CF', '#A8430B'],
  ['#222225', '#FF7A1F'],
];

/**
 * A stand-in profile picture for the sample people: a head and shoulders in
 * the brand colours, with three hair shapes. Replace with real photos once
 * accounts have them. Decorative when the name is written beside it.
 */
export function Avatar({ profile, size = 40, decorative = true }: { profile: Profile | string; size?: number; decorative?: boolean }) {
  const p = typeof profile === 'string' ? resolveAuthor(profile) : profile;
  const [bg, fg] = TONES[p.tone % TONES.length];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="shrink-0 rounded-full"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `${p.name}, profile picture`}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <rect width="48" height="48" fill={bg} />
      {p.shape === 2 && <path d="M13 30c-2-12 3-20 11-20s13 8 11 20c-2-3-4-4-11-4s-9 1-11 4Z" fill={fg} opacity="0.85" />}
      <circle cx="24" cy="19" r="7.5" fill={fg} />
      {p.shape === 0 && <path d="M16 18c0-6 4-9 8-9s8 3 8 9c-3-3-5-4-8-4s-5 1-8 4Z" fill={bg} opacity="0.35" />}
      <path d="M8 48c1-10 7-16 16-16s15 6 16 16Z" fill={fg} />
    </svg>
  );
}
