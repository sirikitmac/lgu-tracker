import Image from 'next/image';

/**
 * Engie, LGU Tracker's owl assistant (public/brand/engie.png, a transparent
 * 512 px drawing). Decorative: the name is always written next to it.
 */
export function EngieMark({ size, className = '', priority }: { size: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/engie.png"
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      priority={priority}
      className={`shrink-0 select-none object-contain ${className}`}
      draggable={false}
    />
  );
}
