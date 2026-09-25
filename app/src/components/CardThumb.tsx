import Image from "next/image";

/** Card image at a fixed 63:88 card ratio, with a placeholder when the catalog has none. */
export function CardThumb({
  src,
  alt,
  width,
  eager = false, // above-the-fold hero image: don't lazy-load it
}: {
  src: string | null;
  alt: string;
  width: number;
  eager?: boolean;
}) {
  const height = Math.round((width * 88) / 63);
  if (!src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-[10px] text-ink-3"
        style={{ width, height }}
        aria-hidden
      >
        No image
      </div>
    );
  }
  // unoptimized: the CDN already serves small PNGs; skipping the resize proxy is faster on first view.
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      className="shrink-0 rounded-md"
      style={{ width, height }}
    />
  );
}
