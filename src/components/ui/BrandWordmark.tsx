import Image from 'next/image';

/**
 * The "Bantay Proyekto" wordmark line of the official lockup (public/brand),
 * cropped from the same artwork for places too short for the full lockup,
 * such as the top bar. White letters for dark surfaces, ink for light ones;
 * the active theme shows one of them (see BrandLockup).
 */
export function BrandWordmark({ className = '', sizes }: { className?: string; sizes?: string }) {
  return (
    <>
      <Image
        src="/brand/wordmark-on-light.png"
        alt="Bantay Proyekto"
        width={640}
        height={78}
        sizes={sizes}
        className={`${className} dark:hidden`}
      />
      <Image
        src="/brand/wordmark-on-dark.png"
        alt="Bantay Proyekto"
        width={640}
        height={78}
        sizes={sizes}
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
