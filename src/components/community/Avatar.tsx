import React from 'react';
import { lookFromSeed, resolveAuthor } from '@/lib/community/profiles';
import type { HairStyle, Profile } from '@/lib/community/types';

/** Soft backgrounds from the brand's warm and cool neutrals. */
const BACKGROUNDS = ['#FFE4CF', '#FFD2B0', '#FFC49A', '#E9EEF2', '#D9E2E8', '#FFE9B8'];
/** Skin tones from lighter to deeper, each with a shade for the neck. */
const SKIN: readonly [string, string][] = [
  ['#F4D3B5', '#E2B795'],
  ['#E6B88E', '#D09F75'],
  ['#D19A6C', '#B8825A'],
  ['#B67D50', '#9C6740'],
  ['#94603A', '#7B4D2D'],
];
const HAIR_COLORS = ['#14100E', '#2B1B12', '#4A3020', '#9A9A9A'];
const TOPS = ['#FF7A1F', '#050F16', '#2F6F8F', '#F4F1EC', '#8A2F2F', '#3D5A3A'];

const LONG_BACK = 'M19 31C17 14 24 9.5 32 9.5S47 14 45 31L47.5 54H16.5Z';
const BOB_BACK = 'M19.5 33C17.5 14 24 10 32 10S46.5 14 44.5 33C44 37 42 39 40 39H24C22 39 20 37 19.5 33Z';
const FRINGE = 'M20.5 27C20 16 26 12 32 12S44 16 43.5 27C41 21 37 18.5 31 18C26 19 22.5 22 20.5 27Z';
const CENTRE_PART = 'M20.5 27C20 15 26 11.5 32 11.5S44 15 43.5 27C40 21 35 17 32 14C29 17 24 21 20.5 27Z';

/** Hair that sits behind the head and shoulders. */
function HairBack({ style, color }: { style: HairStyle; color: string }) {
  if (style === 'long' || style === 'wave') return <path d={LONG_BACK} fill={color} />;
  if (style === 'bob') return <path d={BOB_BACK} fill={color} />;
  if (style === 'bun') return <circle cx="32" cy="8.5" r="5.2" fill={color} />;
  return null;
}

/** Hair that sits over the forehead. */
function HairFront({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'short':
      return <path d="M20 28C19 16 25 11 32 11S45 16 44 28C42 22 40 19 32 19S22 22 20 28Z" fill={color} />;
    case 'side':
      return <path d="M20 28C18 15 26 10 33 10.5S46 17 44 28C43 23 40 20 34 18.5C30 21 24 22 20 28Z" fill={color} />;
    case 'crop':
      return <path d="M20.5 26C20 17 25 12.5 32 12.5S44 17 43.5 26C41.5 21 38 19.5 32 19.5S22.5 21 20.5 26Z" fill={color} />;
    case 'curly':
      return (
        <g fill={color}>
          <circle cx="24" cy="16" r="4.4" />
          <circle cx="29.5" cy="13" r="4.4" />
          <circle cx="35.5" cy="13" r="4.4" />
          <circle cx="40.5" cy="16" r="4.4" />
          <circle cx="21.6" cy="22" r="3.6" />
          <circle cx="42.4" cy="22" r="3.6" />
          <path d="M21 26C21 19 25 15 32 15S43 19 43 26C41 21.5 38 20 32 20S23 21.5 21 26Z" />
        </g>
      );
    case 'wave':
      return <path d={CENTRE_PART} fill={color} />;
    case 'long':
    case 'bob':
    case 'bun':
      return <path d={FRINGE} fill={color} />;
  }
}

/**
 * A stand-in portrait for the sample people: an illustrated face with its own
 * skin tone, hair, clothes and (sometimes) glasses or facial hair. The people
 * are made up, so there is no photo behind it. Swap for real photos once
 * accounts have them. Decorative when the name is written beside it.
 */
export function Avatar({ profile, size = 40, decorative = true }: { profile: Profile | string; size?: number; decorative?: boolean }) {
  const p = typeof profile === 'string' ? resolveAuthor(profile) : profile;
  const look = p.look ?? lookFromSeed(p.id || p.name);
  const [skin, shade] = SKIN[look.skin % SKIN.length];
  const hair = HAIR_COLORS[look.hairColor % HAIR_COLORS.length];
  const top = TOPS[look.top % TOPS.length];
  const bg = BACKGROUNDS[p.tone % BACKGROUNDS.length];
  const darkTop = top === '#050F16' || top === '#8A2F2F' || top === '#3D5A3A';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className="shrink-0 rounded-full"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `${p.name}, profile picture`}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <rect width="64" height="64" fill={bg} />
      <HairBack style={look.hair} color={hair} />
      {/* shoulders, neck and collar */}
      <path d="M8 64C9 52 18 47 32 47S55 52 56 64Z" fill={top} />
      <rect x="27" y="38" width="10" height="11" rx="4" fill={shade} />
      <path d="M25.5 47.2 32 55l6.5-7.8C36 49 34 49.6 32 49.6S28 49 25.5 47.2Z" fill={skin} />
      <path d="M32 55V64" stroke={darkTop ? '#ffffff' : '#050F16'} strokeOpacity="0.18" strokeWidth="1" />
      {/* ears and face */}
      <circle cx="20.7" cy="30" r="2.5" fill={shade} />
      <circle cx="43.3" cy="30" r="2.5" fill={shade} />
      <ellipse cx="32" cy="29" rx="11.5" ry="13.5" fill={skin} />
      {look.facial === 'stubble' && (
        <path d="M21.4 32C22 41 27 44.2 32 44.2S42 41 42.6 32C40 37 36 38.6 32 38.6S24 37 21.4 32Z" fill={hair} opacity="0.32" />
      )}
      <HairFront style={look.hair} color={hair} />
      {/* brows, eyes, nose, mouth, cheeks */}
      <path d="M23.8 24.6Q27.5 22.8 30.6 24.4M33.4 24.4Q36.5 22.8 40.2 24.6" stroke={hair} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <ellipse cx="27.4" cy="29" rx="1.35" ry="1.7" fill="#1B1210" />
      <ellipse cx="36.6" cy="29" rx="1.35" ry="1.7" fill="#1B1210" />
      <circle cx="27.9" cy="28.4" r="0.45" fill="#ffffff" />
      <circle cx="37.1" cy="28.4" r="0.45" fill="#ffffff" />
      <path d="M31 30.5Q30.2 33.4 32 34Q33.8 33.4 33 30.5" stroke={shade} strokeWidth="1" strokeLinecap="round" fill="none" />
      <circle cx="24.6" cy="33.4" r="2.4" fill="#FF7A1F" opacity="0.14" />
      <circle cx="39.4" cy="33.4" r="2.4" fill="#FF7A1F" opacity="0.14" />
      {look.facial === 'mustache' && <path d="M27.2 36Q32 33.7 36.8 36Q32 37.6 27.2 36Z" fill={hair} />}
      <path
        d={look.facial === 'mustache' ? 'M29.2 38.6Q32 40 34.8 38.6' : 'M28.6 36.6Q32 39.2 35.4 36.6'}
        stroke="#8A3B2A"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {look.glasses && (
        <g stroke="#222225" strokeWidth="1.1" fill="none">
          <circle cx="27.4" cy="29" r="4.2" />
          <circle cx="36.6" cy="29" r="4.2" />
          <path d="M31.6 28.6Q32 28 32.4 28.6M23.2 28.4L21.2 27.6M40.8 28.4L42.8 27.6" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
