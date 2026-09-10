import { useState, type DragEvent } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { useSnapResizeEnd } from "../collab/BoardSettingsContext";
import { NoteResizer } from "./NoteResizer";
import { api } from "../api/client";
import "./ShapeNote.css";

export type ShapeKind = "rectangle" | "ellipse" | "triangle" | "diamond";
export type ShapeNoteData = { shape: ShapeKind; color: string; image?: string | null };

export const SHAPE_COLORS = ["#6d6bfa", "#f0607a", "#3fb27f", "#e8a33d", "#a78bfa", "#3fa7d6", "#eceaf0", "#000000"];
export const SHAPES: { id: ShapeKind; label: string }[] = [
  { id: "rectangle", label: "▭" },
  { id: "ellipse", label: "●" },
  { id: "triangle", label: "▲" },
  { id: "diamond", label: "◆" },
];

export function ShapeNote({ id, data, selected }: NodeProps & { data: ShapeNoteData }) {
  const { setNodes } = useReactFlow();
  const onResizeEnd = useSnapResizeEnd(id);
  const [dropActive, setDropActive] = useState(false);

  function remove() {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }

  function patch(update: Partial<ShapeNoteData>) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...update } } : n)));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDropActive(true);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    api.uploadFile(file).then(({ url }) => patch({ image: url })).catch(() => {});
  }

  const fill = data.image ? `center / cover no-repeat url("${data.image}")` : data.color;

  return (
    <div className="shape-note">
      <NoteResizer isVisible={!!selected} minWidth={40} minHeight={40} onResizeEnd={onResizeEnd} />
      <button className="shape-note-delete nodrag" onClick={remove} title="Delete note">
        ×
      </button>
      <div
        className={`shape-note-shape shape-note-shape--${data.shape} ${dropActive ? "shape-note-shape--drop" : ""}`}
        style={{ background: fill }}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDrop}
      />
    </div>
  );
}
