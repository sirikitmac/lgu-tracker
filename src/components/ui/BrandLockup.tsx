import Image from 'next/image';

/**
 * The official Bantay Proyekto lockup (public/brand). The artwork has a white
 * wordmark for dark surfaces and an ink wordmark for light ones, so both are
 * rendered and the active theme (data-theme on <html>) shows one of them. The
 * hidden image is display:none, so it is neither fetched nor read aloud.
 */

type Variant = 'stacked' | 'horizontal';

const SIZE: Record<Variant, { width: number; height: number }> = {
  stacked: { width: 1065, height: 1083 },
  horizontal: { width: 1054, height: 669 },
};

const ALT = 'Bantay Proyekto, LGU Project Tracker';

export function BrandLockup({
  variant = 'stacked',
  className = '',
  sizes,
}: {
  variant?: Variant;
  className?: string;
  /** The rendered width, for the image optimizer (for example "176px"). */
  sizes?: string;
}) {
  const { width, height } = SIZE[variant];
  return (
    <>
      <Image
        src={`/brand/lockup-${variant}-on-light.png`}
        alt={ALT}
        width={width}
        height={height}
        sizes={sizes}
        className={`${className} dark:hidden`}
      />
      <Image
        src={`/brand/lockup-${variant}-on-dark.png`}
        alt={ALT}
        width={width}
        height={height}
        sizes={sizes}
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
