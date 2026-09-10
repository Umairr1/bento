import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { api, ApiError, resolveAssetUrl } from "../api/client";
import { useSnapResizeEnd, useBoardSettings } from "../collab/BoardSettingsContext";
import { NoteResizer } from "./NoteResizer";
import { DEFAULT_MEDIA_TRANSFORM, mediaTransformCss, type MediaTransform } from "./mediaTransform";
import "./ImageNote.css";

export type ImageNoteData = { url: string | null; kind?: "image" | "video"; transform?: MediaTransform };

export function ImageNote({ id, data, selected }: NodeProps & { data: ImageNoteData }) {
  const { setNodes } = useReactFlow();
  const onResizeEnd = useSnapResizeEnd(id);
  const { cornerStyle, lockAspectRatio, gridMode } = useBoardSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Bento's pan mode: double-click a filled image to adjust it inside its frame — drag to pan,
  // wheel to zoom. Off by default so a normal drag still moves the note itself.
  const [adjusting, setAdjusting] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // The bar sits above the note by default, but flips below when the note is near the top of the
  // canvas — otherwise it renders outside the (overflow:hidden) canvas and is invisible.
  const [barBelow, setBarBelow] = useState(false);
  const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number; w: number; h: number } | null>(null);

  function setMedia(url: string, kind: "image" | "video") {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, url, kind } } : n)));
  }

  function patchTransform(update: Partial<MediaTransform>) {
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, transform: { ...DEFAULT_MEDIA_TRANSFORM, ...(n.data as ImageNoteData).transform, ...update } } }
          : n
      )
    );
  }

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setError("Only image or video files are supported");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { url, kind } = await api.uploadFile(file);
      setMedia(url, kind);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function remove() {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }

  const transform = data.transform ?? DEFAULT_MEDIA_TRANSFORM;

  useLayoutEffect(() => {
    if (!selected || !data.url) return;
    const r = rootRef.current?.getBoundingClientRect();
    if (r) setBarBelow(r.top < 100);
  }, [selected, data.url]);

  // Wheel-to-zoom has to be a native non-passive listener: React's onWheel can't preventDefault, and
  // the `nowheel` class is what stops React Flow zooming the whole canvas at the same time.
  useEffect(() => {
    const el = fillRef.current;
    if (!el || !adjusting) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = (data.transform ?? DEFAULT_MEDIA_TRANSFORM).scale;
      patchTransform({ scale: Math.min(4, Math.max(0.5, cur - e.deltaY * 0.0015)) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  useEffect(() => {
    if (!adjusting) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAdjusting(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjusting]);

  useEffect(() => {
    if (!selected) setAdjusting(false);
  }, [selected]);

  function onPanStart(e: ReactPointerEvent<HTMLDivElement>) {
    if (!adjusting) return;
    // Deliberately no stopPropagation: the `nodrag` class already keeps React Flow from starting a
    // node drag here, and swallowing pointer events meant any in-flight drag never saw its pointerup
    // and stayed stuck — leaving the note pinned at a raw position outside the canvas.
    e.preventDefault();
    const rect = fillRef.current?.getBoundingClientRect();
    if (!rect) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, ox: transform.x, oy: transform.y, w: rect.width, h: rect.height };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPanMove(e: ReactPointerEvent<HTMLDivElement>) {
    const p = panRef.current;
    if (!p) return;
    // Offsets are a % of the frame, matching MediaTransform's units, so panning feels the same at
    // any note size or canvas zoom.
    const nx = p.ox + ((e.clientX - p.startX) / p.w) * 100;
    const ny = p.oy + ((e.clientY - p.startY) / p.h) * 100;
    patchTransform({ x: Math.max(-80, Math.min(80, nx)), y: Math.max(-80, Math.min(80, ny)) });
  }

  function onPanEnd() {
    panRef.current = null;
  }

  const zoomBy = (d: number) => patchTransform({ scale: Math.min(4, Math.max(0.5, transform.scale + d)) });

  return (
    <div
      ref={rootRef}
      className={`image-note ${gridMode ? "image-note--grid" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <NoteResizer
        isVisible={!!selected}
        minWidth={140}
        minHeight={120}
        onResizeEnd={onResizeEnd}
        keepAspectRatio={lockAspectRatio}
      />
      <button className="image-note-delete nodrag" onClick={remove} title="Delete note">
        ×
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="nodrag"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {data.url && selected && (
        <div className={`image-note-bar nodrag ${barBelow ? "image-note-bar--below" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
          {([
            ["cover", "Crop", "Crop to fill the frame"],
            ["contain", "Fit", "Fit the whole image inside"],
            ["fill", "Fill", "Stretch to the frame"],
          ] as const).map(([f, label, tip]) => (
            <button
              key={f}
              className={`inb-btn inb-btn--text ${transform.fit === f ? "active" : ""}`}
              onClick={() => patchTransform({ fit: f })}
              title={tip}
            >
              {label}
            </button>
          ))}
          <span className="inb-sep" />
          <button className="inb-btn" onClick={() => zoomBy(-0.15)} title="Zoom out">
            −
          </button>
          <span className="inb-val">{Math.round(transform.scale * 100)}%</span>
          <button className="inb-btn" onClick={() => zoomBy(0.15)} title="Zoom in">
            +
          </button>
          <span className="inb-sep" />
          <button className="inb-btn" onClick={() => patchTransform({ rotation: (transform.rotation + 90) % 360 })} title="Rotate 90°">
            ⟳
          </button>
          <button className={`inb-btn ${transform.flipH ? "active" : ""}`} onClick={() => patchTransform({ flipH: !transform.flipH })} title="Flip horizontal">
            ⇋
          </button>
          <button className={`inb-btn ${transform.flipV ? "active" : ""}`} onClick={() => patchTransform({ flipV: !transform.flipV })} title="Flip vertical">
            ⇅
          </button>
          <span className="inb-sep" />
          <button className={`inb-btn ${adjusting ? "active" : ""}`} onClick={() => setAdjusting((v) => !v)} title="Adjust inside frame (or double-click the image)">
            ✥
          </button>
          <button className="inb-btn" onClick={() => fileInputRef.current?.click()} title="Replace media">
            ⟲
          </button>
          <button
            className="inb-btn"
            onClick={() => patchTransform({ x: 0, y: 0, scale: 1, rotation: 0, flipH: false, flipV: false })}
            title="Reset adjustments"
          >
            ⌾
          </button>
        </div>
      )}

      {data.url ? (
        <div
          ref={fillRef}
          className={`image-note-fill note-shape--${cornerStyle} ${adjusting ? "image-note-fill--adjusting nodrag nowheel" : ""}`}
          style={{ background: transform.bg }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setAdjusting((v) => !v);
          }}
          onPointerDown={onPanStart}
          onPointerMove={onPanMove}
          onPointerUp={onPanEnd}
          onPointerCancel={onPanEnd}
        >
          {data.kind === "video" ? (
            <video
              className="nodrag"
              src={resolveAssetUrl(data.url)}
              style={{
                objectFit: transform.fit,
                opacity: transform.opacity,
                transform: mediaTransformCss(transform),
              }}
              autoPlay
              loop
              muted
              playsInline
              controls={!!selected}
            />
          ) : (
            <img
              src={resolveAssetUrl(data.url)}
              alt=""
              style={{
                objectFit: transform.fit,
                opacity: transform.opacity,
                transform: mediaTransformCss(transform),
              }}
            />
          )}
          {adjusting && <span className="image-note-adjust-hint">Drag to move · scroll to zoom · Esc to finish</span>}
        </div>
      ) : (
        <div
          className={`image-note-dropzone note-shape--${cornerStyle} ${dragOver ? "drag-over" : ""} ${gridMode ? "image-note-dropzone--grid" : ""}`}
          onClick={gridMode ? () => fileInputRef.current?.click() : undefined}
        >
          {uploading ? (
            <span>Uploading…</span>
          ) : gridMode ? (
            <span className="image-note-dropzone-hint">Drop image or video</span>
          ) : (
            <>
              <button className="nodrag image-note-upload-btn" onClick={() => fileInputRef.current?.click()}>
                Upload image or video
              </button>
              <span className="image-note-dropzone-hint">or drag / paste one here</span>
            </>
          )}
          {error && <span className="image-note-error">{error}</span>}
        </div>
      )}
    </div>
  );
}
