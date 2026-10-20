import type { ComponentProps } from "react";

type Dimensions = { url?: string | null; width?: number | null; height?: number | null };

/** The fields of an upload document that an image needs, with the transformer's variants. */
export type UploadDocument = Dimensions & {
  alt?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  variants?: Record<string, Dimensions | null | undefined> | null;
};

/** An image to render with `Media`. It is plain data, so a server function can return it. */
export type ImageSource = {
  url: string;
  alt: string;
  width: number;
  height: number;
  /** The original and each variant with its aspect ratio, narrowest first. */
  candidates: { url: string; width: number }[];
  /** The part of the image to keep in view when it is cropped, as percentages from the top left. */
  focalPoint?: { x: number; y: number };
};

const isSized = <TImage extends Dimensions>(
  image: TImage,
): image is TImage & { url: string; width: number; height: number } =>
  Boolean(image.url && image.width && image.height);

/**
 * The image in an upload field, or `undefined` when the field is empty or holds only an ID. A
 * variant is a candidate for `srcset` only when it has a URL and keeps the original's aspect
 * ratio, so a cropped variant, such as an Open Graph image, never replaces the original. The
 * transformer skips a variant larger than the original, so a small image has only itself.
 */
export const toImageSource = (
  upload: number | string | UploadDocument | null | undefined,
): ImageSource | undefined => {
  if (typeof upload !== "object" || upload === null || !isSized(upload)) return undefined;
  const ratio = upload.width / upload.height;
  const variants = Object.values(upload.variants ?? {}).filter(
    (variant): variant is Dimensions & { url: string; width: number; height: number } =>
      variant !== null &&
      variant !== undefined &&
      isSized(variant) &&
      Math.abs(variant.width / variant.height / ratio - 1) < 0.02,
  );
  const candidates = [...variants, upload]
    .map(({ url, width }) => ({ url, width }))
    .filter((candidate, index, all) => all.findIndex((c) => c.width === candidate.width) === index)
    .toSorted((a, b) => a.width - b.width);
  return {
    url: upload.url,
    alt: upload.alt ?? "",
    width: upload.width,
    height: upload.height,
    candidates,
    focalPoint:
      upload.focalX != null && upload.focalY != null
        ? { x: upload.focalX, y: upload.focalY }
        : undefined,
  };
};

/** Scales each width in a `sizes` list, such as `(min-width: 1024px) 370px, 100vw`. */
const scaleSizes = (sizes: string, factor: number) =>
  sizes
    .split(",")
    .map((entry) =>
      entry.trim().replace(/\S+$/, (width) => `calc(${width} * ${factor.toFixed(2)})`),
    )
    .join(", ");

export type MediaProps = Omit<
  ComponentProps<"img">,
  "alt" | "height" | "src" | "srcSet" | "width"
> & {
  image: ImageSource;
  /** How wide the image renders at each breakpoint, as the `sizes` attribute. */
  sizes: string;
  /** Loads the image eagerly with high fetch priority. Use it for the first image on screen. */
  priority?: boolean;
  /**
   * The width-to-height ratio of a box that the image covers with `object-fit: cover`. A wider
   * image overflows the box, so `sizes` grows by the overflow and the browser picks a larger copy.
   */
  cover?: number;
};

/**
 * An `<img>` for an upload, with a `srcset` of its variants and its focal point as
 * `object-position`. Without variants, it shows the original.
 */
export const Media = ({ image, sizes, priority = false, cover, style, ...props }: MediaProps) => {
  const overflow = cover ? image.width / image.height / cover : 1;
  const responsive = image.candidates.length > 1;
  return (
    <img
      src={image.url}
      srcSet={
        responsive
          ? image.candidates.map(({ url, width }) => `${url} ${width}w`).join(", ")
          : undefined
      }
      sizes={responsive ? (overflow > 1 ? scaleSizes(sizes, overflow) : sizes) : undefined}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      style={
        image.focalPoint
          ? { objectPosition: `${image.focalPoint.x}% ${image.focalPoint.y}%`, ...style }
          : style
      }
      {...props}
    />
  );
};
