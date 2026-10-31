declare module 'polylabel' {
  /** Pole of inaccessibility of a polygon given as GeoJSON-style rings. */
  export default function polylabel(polygon: number[][][], precision?: number, debug?: boolean): number[] & { distance: number };
}
