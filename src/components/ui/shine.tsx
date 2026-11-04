import React from 'react';

/**
 * The hover effect of the orange Sign In button, for buttons that stay quiet
 * until someone points at them: an outline at rest; on hover the orange
 * gradient slides in, a glint crosses, the button lifts and glows; a click
 * presses it in. Dark text on the orange (white would not be readable).
 * Reduced motion keeps the colour change only.
 *
 * Use the class on a <button> or <Link>, put <ShineLayers /> first, then the
 * label inside a `relative z-10` wrapper so it stays above the colour.
 */

const GRADIENT = 'bg-[linear-gradient(110deg,#FFB067_0%,#FF7A1F_45%,#F0620A_100%)]';

export function shineOutlineClass(size: 'sm' | 'lg' = 'sm'): string {
  const sizing =
    size === 'sm' ? 'h-9 rounded-full px-3 text-[13px]' : 'min-h-[48px] w-full rounded-xl px-4 text-sm';
  return `group relative isolate inline-flex cursor-pointer items-center justify-center overflow-hidden border border-line-strong bg-surface font-semibold text-ink transition-[transform,box-shadow,border-color,color] duration-300 ease-out hover:-translate-y-0.5 hover:border-[#FF9A4D] hover:text-night hover:shadow-[0_14px_26px_-12px_rgba(255,122,31,0.9)] focus-visible:text-night active:translate-y-0 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink ${sizing}`;
}

export function ShineLayers() {
  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 opacity-0 transition-[opacity,background-position] duration-500 ease-out ${GRADIENT} bg-[length:190%_100%] bg-[position:0%_50%] group-hover:bg-[position:100%_50%] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/3 z-0 w-1/5 -skew-x-[20deg] bg-white/35 blur-[2px] group-hover:animate-[bp-shine_900ms_ease-in-out_1] motion-reduce:hidden"
      />
    </>
  );
}
