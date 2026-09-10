import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import { resolveAssetUrl } from "../api/client";
import type { TextNoteData } from "../notes/TextNote";
import type { ImageNoteData } from "../notes/ImageNote";
import type { LinkNoteData } from "../notes/LinkNote";
import type { ChecklistNoteData } from "../notes/ChecklistNote";
import type { ColumnNoteData } from "../notes/ColumnNote";
import type { BoardNoteData } from "../notes/BoardNote";
import type { ShapeNoteData } from "../notes/ShapeNote";
import type { DrawingNoteData } from "../notes/DrawingNote";
import { buildSmoothPath } from "../notes/drawingPath";
import { DEFAULT_TEXT_STYLE } from "../notes/textStyle";
import type { PresentationSettings, SlideDirection } from "../canvas/presentationSettings";
import "./PresentationView.css";

export function sortForPresentation(nodes: Node[]): Node[] {
  return [...nodes].sort((a, b) => {
    const rowA = Math.round(a.position.y / 80);
    const rowB = Math.round(b.position.y / 80);
    if (rowA !== rowB) return rowA - rowB;
    return a.position.x - b.position.x;
  });
}

export function enterAxis(direction: SlideDirection) {
  switch (direction) {
    case "left":
      return { x: 60, y: 0 };
    case "right":
      return { x: -60, y: 0 };
    case "up":
      return { x: 0, y: 60 };
    case "down":
      return { x: 0, y: -60 };
  }
}

export function SlideCard({ node }: { node: Node }) {
  switch (node.type) {
    case "textNote": {
      const data = node.data as TextNoteData;
      const style = data.style ?? DEFAULT_TEXT_STYLE;
      return (
        <div className="pv-card pv-card--text">
          <p
            style={{
              fontFamily: style.fontFamily,
              textAlign: style.align,
              fontWeight: style.bold ? 700 : undefined,
              fontStyle: style.italic ? "italic" : undefined,
              textDecoration: style.underline ? "underline" : undefined,
            }}
          >
            {data.text || "(empty note)"}
          </p>
        </div>
      );
    }
    case "imageNote": {
      const data = node.data as ImageNoteData;
      if (!data.url) return <div className="pv-card pv-card--image pv-empty">No media</div>;
      return (
        <div className="pv-card pv-card--image">
          {data.kind === "video" ? (
            <video src={resolveAssetUrl(data.url)} autoPlay loop muted playsInline />
          ) : (
            <img src={resolveAssetUrl(data.url)} alt="" />
          )}
        </div>
      );
    }
    case "shapeNote": {
      const data = node.data as ShapeNoteData;
      return (
        <div className="pv-card pv-card--shape">
          <div className={`pv-shape pv-shape--${data.shape}`} style={{ background: data.color }} />
        </div>
      );
    }
    case "drawingNote": {
      const data = node.data as DrawingNoteData;
      return (
        <div className="pv-card pv-card--drawing">
          <svg viewBox="0 0 1 1" preserveAspectRatio="none">
            <path
              d={buildSmoothPath(data.points)}
              fill="none"
              stroke={data.color}
              strokeWidth={data.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      );
    }
    case "linkNote": {
      const data = node.data as LinkNoteData;
      if (!data.url) return <div className="pv-card pv-card--link pv-empty">No link</div>;
      return (
        <a className="pv-card pv-card--link" href={data.url} target="_blank" rel="noreferrer noopener">
          {data.image && <img src={resolveAssetUrl(data.image)} alt="" />}
          <div className="pv-link-body">
            <h2>{data.title ?? data.url}</h2>
            {data.description && <p>{data.description}</p>}
            <span>{new URL(data.url).hostname}</span>
          </div>
        </a>
      );
    }
    case "checklistNote": {
      const data = node.data as ChecklistNoteData;
      return (
        <div className="pv-card pv-card--checklist">
          <h2>{data.title || "Checklist"}</h2>
          <ul>
            {data.items.map((it) => (
              <li key={it.id} className={it.done ? "done" : ""}>
                <span className="pv-check">{it.done ? "✓" : "○"}</span>
                {it.text || "(untitled task)"}
                {it.dueDate && <span className="pv-due">{it.dueDate}</span>}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "columnNote": {
      const data = node.data as ColumnNoteData;
      return (
        <div className="pv-card pv-card--column">
          <h2>{data.title || "Column"}</h2>
          <ul>
            {data.items.map((it) => (
              <li key={it.id}>{it.text || "(empty item)"}</li>
            ))}
          </ul>
        </div>
      );
    }
    case "boardNote": {
      const data = node.data as BoardNoteData;
      return (
        <div className="pv-card pv-card--board">
          <span className="pv-board-icon">▦</span>
          <h2>{data.title || "Untitled board"}</h2>
        </div>
      );
    }
    default:
      return <div className="pv-card pv-empty">Unsupported note</div>;
  }
}

export function PresentationView({
  nodes,
  settings,
  onClose,
}: {
  nodes: Node[];
  settings: PresentationSettings;
  onClose: () => void;
}) {
  const ordered = useMemo(() => sortForPresentation(nodes), [nodes]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(settings.autoPlay);
  const [enterKey, setEnterKey] = useState(0);

  const goTo = useCallback(
    (i: number) => {
      if (ordered.length === 0) return;
      const next = ((i % ordered.length) + ordered.length) % ordered.length;
      setIndex(next);
      setEnterKey((k) => k + 1);
    },
    [ordered.length]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (!playing || ordered.length < 2) return;
    const t = setTimeout(next, settings.holdPacing * 1000);
    return () => clearTimeout(t);
  }, [playing, index, ordered.length, settings.holdPacing, next]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, prev, onClose]);

  if (ordered.length === 0) {
    return (
      <div className="pv-overlay">
        <button className="pv-close" onClick={onClose}>
          × Close
        </button>
        <div className="pv-empty-state">No notes on this board yet.</div>
      </div>
    );
  }

  const axis = enterAxis(settings.direction);
  const current = ordered[index];

  return (
    <div className="pv-overlay">
      <button className="pv-close" onClick={onClose} title="Close (Esc)">
        × Close
      </button>

      <button className="pv-nav pv-nav--prev" onClick={prev} title="Previous (←)">
        ‹
      </button>
      <button className="pv-nav pv-nav--next" onClick={next} title="Next (→)">
        ›
      </button>

      <div className="pv-stage">
        <div
          key={enterKey}
          className="pv-slide"
          style={
            {
              animationDuration: `${settings.slideSpeed}s`,
              "--enter-x": `${axis.x}px`,
              "--enter-y": `${axis.y}px`,
            } as CSSProperties
          }
        >
          <SlideCard node={current} />
        </div>
      </div>

      <div className="pv-footer">
        <button className="pv-play" onClick={() => setPlaying((p) => !p)} title="Play/pause (Space)">
          {playing ? "⏸" : "▶"}
        </button>
        <span className="pv-counter">
          {index + 1} / {ordered.length}
        </span>
        <div className="pv-dots">
          {ordered.map((n, i) => (
            <button
              key={n.id}
              className={`pv-dot ${i === index ? "active" : ""}`}
              onClick={() => goTo(i)}
              title={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
