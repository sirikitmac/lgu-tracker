'use client';

import React, { useState } from 'react';
import { Avatar } from '@/components/community/Avatar';
import { avatarPublicUrl, initialsOf, presetById } from '@/lib/profile/avatars';

/**
 * A person's picture: their uploaded photo, else the free avatar they chose,
 * else their initials. A photo that fails to load falls back to the initials,
 * so a broken link never leaves a hole.
 */
export function UserAvatar({
  name,
  avatarPath,
  avatarPreset,
  previewUrl,
  size = 40,
  decorative = true,
  className = '',
}: {
  name: string;
  avatarPath?: string | null;
  avatarPreset?: string | null;
  /** A local picture shown before it is saved (an object URL). Wins over the saved one. */
  previewUrl?: string | null;
  size?: number;
  /** True when the name is written next to it. */
  decorative?: boolean;
  className?: string;
}) {
  const url = previewUrl ?? avatarPublicUrl(avatarPath);
  const [failed, setFailed] = useState<string | null>(null);
  const label = decorative ? undefined : `${name || 'Your account'}, profile picture`;

  if (url && failed !== url) {
    return (
      // A plain img: the file is already a small square, and its host is the project's own storage.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={decorative ? '' : label}
        aria-hidden={decorative ? true : undefined}
        width={size}
        height={size}
        decoding="async"
        onError={() => setFailed(url)}
        className={`shrink-0 rounded-full bg-sunken object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const preset = presetById(avatarPreset);
  if (preset) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden rounded-full ${className}`} style={{ width: size, height: size }}>
        <Avatar
          profile={{ id: preset.id, name: name || 'You', place: '', tag: '', tone: preset.bg, shape: 0, look: preset.look }}
          size={size}
          decorative={decorative}
        />
      </span>
    );
  }

  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={label}
      aria-hidden={decorative ? true : undefined}
      className={`grid shrink-0 place-items-center rounded-full bg-accent font-bold text-night ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
    >
      {initialsOf(name)}
    </span>
  );
}
