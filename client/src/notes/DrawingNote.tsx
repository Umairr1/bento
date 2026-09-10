import type { CSSProperties } from "react";
import { useReactFlow, useViewport, type NodeProps } from "@xyflow/react";
import { useSnapResizeEnd } from "../collab/BoardSettingsContext";
import { NoteResizer } from "./NoteResizer";
import { buildSmoothPath, type Point } from "./drawingPath";
import "./DrawingNote.css";

export type DrawingNoteData = { points: Point[]; color: string; strokeWidth: number };

export const DRAWING_COLORS = ["#eceaf0", "#6d6bfa", "#f0607a", "#3fb27f", "#e8a33d", "#a78bfa", "#3fa7d6", "#000000"];

export function DrawingNote({ id, data, selected }: NodeProps & { data: DrawingNoteData }) {
  const { setNodes } = useReactFlow();
  const onResizeEnd = useSnapResizeEnd(id);
  const { zoom } = useViewport();

  function patch(update: Partial<DrawingNoteData>) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...update } } : n)));
  }

  function remove() {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }

  return (
    <div className="drawing-note">
      <NoteResizer isVisible={!!selected} minWidth={24} minHeight={24} onResizeEnd={onResizeEnd} />
      <button className="drawing-note-delete nodrag" onClick={remove} title="Delete drawing">
        ×
      </button>

      <svg className="drawing-note-svg" viewBox="0 0 1 1" preserveAspectRatio="none">
        <rect x="0" y="0" width="1" height="1" fill="transparent" />
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

      {selected && (
        <div
          className="drawing-note-controls nodrag"
          style={{ "--counter-zoom": 1 / Math.max(zoom, 0.0001) } as CSSProperties}
        >
          <div className="drawing-note-colors">
            {DRAWING_COLORS.map((c) => (
              <button
                key={c}
                className={`drawing-note-color-btn ${data.color === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => patch({ color: c })}
                title={c}
              />
            ))}
            <input
              type="color"
              className="drawing-note-color-custom"
              value={data.color}
              onChange={(e) => patch({ color: e.target.value })}
              title="Custom color"
            />
          </div>
          <input
            type="range"
            min={1}
            max={14}
            value={data.strokeWidth}
            onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
            title="Stroke width"
          />
        </div>
      )}
    </div>
  );
}
