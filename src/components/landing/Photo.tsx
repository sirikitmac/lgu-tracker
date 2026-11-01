import { getImageProps } from 'next/image';
import { BLUR } from './blur.generated';
import { FadeImg } from './FadeImg';

/**
 * A landing-page photograph that fills its (positioned) box: optimized by
 * next/image, with its blur placeholder painted on the box behind it and the
 * picture fading in over it once loaded, instead of popping in.
 *
 * The placeholder lives on the wrapper, not the <img>, so the image can fade
 * from transparent without fading the placeholder too. Without JavaScript the
 * picture is simply shown (the fade is gated on html[data-js]).
 *
 * Server component: the blur table stays on the server, only each picture's
 * own ~150-byte preview reaches the HTML.
 */
export function Photo({
  src,
  sizes,
  alt = '',
  loading = 'lazy',
  fetchPriority,
  critical = false,
  fade = true,
  quality,
  className = '',
  imgClassName = '',
}: {
  src: string;
  sizes: string;
  alt?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Counted by the first-visit loader (FirstVisitLoader) as part of the first screen. */
  critical?: boolean;
  /** Fade in once loaded (default). Off for the hero wall, whose tiles are the LCP candidates. */
  fade?: boolean;
  /** One of images.qualities in next.config.mjs; 75 when unset. */
  quality?: 50 | 75;
  className?: string;
  imgClassName?: string;
}) {
  const blurDataURL = BLUR[src];
  const { props } = getImageProps({
    src,
    alt,
    fill: true,
    sizes,
    loading,
    fetchPriority,
    quality,
    placeholder: blurDataURL ? 'blur' : 'empty',
    blurDataURL,
  });
  const { style = {}, ...img } = props;
  const { backgroundImage, backgroundSize, backgroundPosition, backgroundRepeat, ...imgStyle } = style;
  return (
    <span className={`photo ${className}`} style={{ backgroundImage, backgroundSize, backgroundPosition, backgroundRepeat }}>
      <FadeImg {...img} style={imgStyle} data-critical={critical ? '' : undefined} data-instant={fade ? undefined : ''} className={`object-cover ${imgClassName}`} />
    </span>
  );
}
