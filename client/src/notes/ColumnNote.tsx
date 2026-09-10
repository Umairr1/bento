import { useReactFlow, type NodeProps } from "@xyflow/react";
import { useSnapResizeEnd, useBoardSettings } from "../collab/BoardSettingsContext";
import { NoteResizer } from "./NoteResizer";
import "./ColumnNote.css";

export type ColumnItem = { id: string; text: string };
export type ColumnNoteData = { title: string; items: ColumnItem[] };

export function ColumnNote({ id, data, selected }: NodeProps & { data: ColumnNoteData }) {
  const { setNodes } = useReactFlow();
  const onResizeEnd = useSnapResizeEnd(id);
  const { cornerStyle, lockAspectRatio } = useBoardSettings();

  function patch(update: Partial<ColumnNoteData>) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...update } } : n)));
  }

  function updateItem(itemId: string, text: string) {
    patch({ items: data.items.map((it) => (it.id === itemId ? { ...it, text } : it)) });
  }

  function addItem() {
    patch({ items: [...data.items, { id: crypto.randomUUID(), text: "" }] });
  }

  function removeItem(itemId: string) {
    patch({ items: data.items.filter((it) => it.id !== itemId) });
  }

  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= data.items.length) return;
    const items = [...data.items];
    [items[index], items[target]] = [items[target], items[index]];
    patch({ items });
  }

  function remove() {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }

  return (
    <div className="column-note">
      <NoteResizer
        isVisible={!!selected}
        minWidth={180}
        minHeight={160}
        onResizeEnd={onResizeEnd}
        keepAspectRatio={lockAspectRatio}
      />
      <button className="column-note-delete nodrag" onClick={remove} title="Delete note">
        ×
      </button>

      <div className={`column-note-shape note-shape--${cornerStyle}`}>
        <input
          className="nodrag column-title"
          placeholder="Column"
          value={data.title}
          onChange={(e) => patch({ title: e.target.value })}
        />

        <div className="column-items">
          {data.items.map((item, index) => (
            <div className="column-row" key={item.id}>
              <div className="column-row-move">
                <button className="nodrag" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                  ↑
                </button>
                <button className="nodrag" onClick={() => moveItem(index, 1)} disabled={index === data.items.length - 1}>
                  ↓
                </button>
              </div>
              <input
                className="nodrag column-text"
                placeholder="Item"
                value={item.text}
                onChange={(e) => updateItem(item.id, e.target.value)}
              />
              <button className="nodrag column-remove" onClick={() => removeItem(item.id)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <button className="nodrag column-add" onClick={addItem}>
          + Add item
        </button>
      </div>
    </div>
  );
}
