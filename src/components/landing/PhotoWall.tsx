import Image from 'next/image';
import { WALL_COLUMNS } from './wall';

/**
 * The hero's backdrop: three tilted columns of public-works photographs
 * drifting slowly in opposite directions, under a dark shade so the headline
 * reads. Pure CSS (runs off the main thread); still under reduced motion.
 * Decorative, so hidden from screen readers; the credits are in "About the data".
 */
export function PhotoWall() {
  return (
    <div className="wall" aria-hidden="true">
      <div className="wall-tilt">
        {WALL_COLUMNS.map((column, c) => (
          <div key={c} className={`wall-col wall-col-${c}`}>
            {/* Two copies of the column, so a -50% shift loops without a seam. */}
            <div className="wall-track">
              {[0, 1].map((copy) =>
                column.map((photo, i) => (
                  <figure key={`${copy}-${photo.src}`} className="wall-tile">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-white/5">
                      <Image
                        src={photo.src}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 34vw, 46vw"
                        loading={copy === 0 && i < 2 ? 'eager' : 'lazy'}
                        className="object-cover"
                      />
                    </div>
                    <figcaption className="wall-caption">
                      <span className="truncate">{photo.caption}</span>
                      <span className="shrink-0 opacity-75"> · Illustrative</span>
                    </figcaption>
                  </figure>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="wall-shade" />
    </div>
  );
}
