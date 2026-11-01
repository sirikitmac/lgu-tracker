'use client';

/**
 * A plain <img> (props from next/image's getImageProps) that marks itself
 * `data-loaded` once its picture is in, so CSS can fade it over the blur
 * placeholder behind it (see .photo in globals.css). Pictures that finished
 * before hydration are marked when the ref attaches. The attribute is set on
 * the DOM node directly: React never renders it, so hydration sees no mismatch.
 */
export function FadeImg(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      ref={(img) => {
        if (img?.complete && img.naturalWidth > 0) img.dataset.loaded = '';
      }}
      onLoad={(e) => {
        e.currentTarget.dataset.loaded = '';
      }}
    />
  );
}
