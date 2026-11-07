/**
 * The maths behind the square crop for a profile photo. The picture is shown
 * "cover" style inside a square window, can be zoomed in and dragged, and
 * never leaves a gap at the edges. Pure functions so they can be tested.
 */

export interface View {
  /** Natural size of the picture. */
  width: number;
  height: number;
  /** Side of the square window, in screen pixels. */
  size: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Pixels on screen per picture pixel when the picture just covers the window. */
export const coverScale = (v: View): number => v.size / Math.min(v.width, v.height);

export const scaleFor = (v: View, zoom: number): number => coverScale(v) * clamp(zoom, MIN_ZOOM, MAX_ZOOM);

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export interface Offset {
  /** Where the picture's top-left corner sits relative to the window's top-left. Zero or negative. */
  x: number;
  y: number;
}

/** Keeps the picture covering the window. */
export function clampOffset(v: View, scale: number, o: Offset): Offset {
  const minX = Math.min(0, v.size - v.width * scale);
  const minY = Math.min(0, v.size - v.height * scale);
  return { x: clamp(o.x, minX, 0), y: clamp(o.y, minY, 0) };
}

/** The picture centred in the window. */
export function centred(v: View, scale: number): Offset {
  return clampOffset(v, scale, { x: (v.size - v.width * scale) / 2, y: (v.size - v.height * scale) / 2 });
}

/** Changes the zoom while the point at the middle of the window stays put. */
export function zoomKeepingCentre(v: View, from: { scale: number; offset: Offset }, nextScale: number): Offset {
  const cx = (v.size / 2 - from.offset.x) / from.scale;
  const cy = (v.size / 2 - from.offset.y) / from.scale;
  return clampOffset(v, nextScale, { x: v.size / 2 - cx * nextScale, y: v.size / 2 - cy * nextScale });
}

/** The part of the original picture that is inside the window, in picture pixels. */
export function sourceRect(v: View, scale: number, o: Offset): { sx: number; sy: number; side: number } {
  const side = v.size / scale;
  return {
    sx: clamp(-o.x / scale, 0, Math.max(0, v.width - side)),
    sy: clamp(-o.y / scale, 0, Math.max(0, v.height - side)),
    side,
  };
}
