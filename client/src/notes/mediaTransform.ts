export type MediaFit = "cover" | "contain" | "fill";

export type MediaTransform = {
  x: number; // -80..80, % pan offset
  y: number; // -80..80, % pan offset
  scale: number; // 0.5..4, zoom
  rotation: number; // -180..180, degrees
  flipH: boolean;
  flipV: boolean;
  opacity: number; // 0..1
  fit: MediaFit;
  bg: string; // hex, shown behind the image when fit is "contain"
};

export const DEFAULT_MEDIA_TRANSFORM: MediaTransform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
  opacity: 1,
  fit: "fill",
  bg: "#000000",
};

export function mediaTransformCss(t: MediaTransform): string {
  const flipX = t.flipH ? -1 : 1;
  const flipY = t.flipV ? -1 : 1;
  return `translate(${t.x}%, ${t.y}%) rotate(${t.rotation || 0}deg) scale(${t.scale * flipX}, ${t.scale * flipY})`;
}
