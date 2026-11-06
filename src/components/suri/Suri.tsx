import React from 'react';
import Image from 'next/image';

/**
 * Suri, Bantay Proyekto's tarsier mascot and AI assistant. One picture per
 * mood (public/suri); pick the one that fits the place it appears in.
 */
export type SuriPose =
  | 'guide' // default, main look
  | 'analyst' // investigation, analysis
  | 'assistant' // chat, support
  | 'explorer' // browsing projects
  | 'builder' // infrastructure, projects
  | 'data' // data, insights
  | 'communicator' // community
  | 'advisor' // learning, awareness
  | 'checker' // verifying, reports
  | 'friendly'; // greeting, empty states

const ALT: Record<SuriPose, string> = {
  guide: 'Suri the tarsier holding a tablet',
  analyst: 'Suri the tarsier looking through a magnifying glass',
  assistant: 'Suri the tarsier wearing a headset at a laptop',
  explorer: 'Suri the tarsier looking through binoculars',
  builder: 'Suri the tarsier in a hard hat holding a checklist',
  data: 'Suri the tarsier with glasses and a chart',
  communicator: 'Suri the tarsier cheering with a megaphone',
  advisor: 'Suri the tarsier in a graduation cap reading a book',
  checker: 'Suri the tarsier holding a clipboard with a check mark',
  friendly: 'Suri the tarsier peeking over the edge',
};

/**
 * `decorative` (the default) hides the picture from screen readers, for when
 * the text beside it already says what matters. Set it to false where the
 * picture stands alone.
 */
export function Suri({
  pose = 'guide',
  size = 120,
  decorative = true,
  className = '',
  priority = false,
}: {
  pose?: SuriPose;
  /** Width and height of the box the picture is fitted into, in pixels. */
  size?: number;
  decorative?: boolean;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={`/suri/${pose}.webp`}
      alt={decorative ? '' : ALT[pose]}
      width={size}
      height={size}
      sizes={`${size}px`}
      priority={priority}
      quality={90}
      draggable={false}
      className={`select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Suri's round face, for chat bubbles and buttons. */
export function SuriFace({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/suri/face.webp"
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      quality={90}
      draggable={false}
      className={`shrink-0 select-none rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
