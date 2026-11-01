import { Photo } from './Photo';
import { WALL_COLUMNS } from './wall';

/**
 * Tile widths. The tilted wall spans 74% of the hero in three columns from
 * 768px up (about 24vw a tile) and 140% in two columns below (about 68vw).
 * The third column is display:none on phones; its 1px slot there makes the
 * browser fetch only the smallest variant instead of a picture nobody sees.
 */
const SIZES = ['(min-width: 768px) 24vw, 68vw', '(min-width: 768px) 24vw, 68vw', '(min-width: 768px) 24vw, 1px'];

/**
 * The hero's backdrop: three tilted columns of public-works photographs
 * drifting slowly in opposite directions, under a dark shade so the headline
 * reads. Pure CSS (runs off the main thread); still under reduced motion.
 * Decorative, so hidden from screen readers; the credits are in "About the data".
 *
 * Every tile loads eagerly. The columns clip their tracks and move them by
 * transform, so a lazy tile below a column's edge never counts as near the
 * viewport and would only start loading as it drifted into view (a blank
 * tile, then a pop). The second copy of each column reuses the first copy's
 * URLs, so the wall costs 15 requests, the first two per column at normal
 * priority (they are what the first screen shows) and the rest at low.
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
                    <Photo
                      src={photo.src}
                      sizes={SIZES[c]}
                      loading="eager"
                      fetchPriority={i < 2 ? 'auto' : 'low'}
                      critical={copy === 0 && i < 2}
                      className="aspect-[4/3] rounded-[14px] bg-white/5"
                    />
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
