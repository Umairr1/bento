import { useReactFlow, type NodeProps } from "@xyflow/react";
import { useSnapResizeEnd, useBoardSettings } from "../collab/BoardSettingsContext";
import { NoteResizer } from "./NoteResizer";
import "./ChecklistNote.css";

export type ChecklistItem = { id: string; text: string; done: boolean; dueDate: string | null };
export type ChecklistNoteData = { title: string; items: ChecklistItem[] };

export function ChecklistNote({ id, data, selected }: NodeProps & { data: ChecklistNoteData }) {
  const { setNodes } = useReactFlow();
  const onResizeEnd = useSnapResizeEnd(id);
  const { cornerStyle, lockAspectRatio } = useBoardSettings();

  function patch(update: Partial<ChecklistNoteData>) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...update } } : n)));
  }

  function updateItem(itemId: string, update: Partial<ChecklistItem>) {
    patch({ items: data.items.map((it) => (it.id === itemId ? { ...it, ...update } : it)) });
  }

  function addItem() {
    patch({ items: [...data.items, { id: crypto.randomUUID(), text: "", done: false, dueDate: null }] });
  }

  function removeItem(itemId: string) {
    patch({ items: data.items.filter((it) => it.id !== itemId) });
  }

  function remove() {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }

  return (
    <div className="checklist-note">
      <NoteResizer
        isVisible={!!selected}
        minWidth={200}
        minHeight={140}
        onResizeEnd={onResizeEnd}
        keepAspectRatio={lockAspectRatio}
      />
      <button className="checklist-note-delete nodrag" onClick={remove} title="Delete note">
        ×
      </button>

      <div className={`checklist-note-shape note-shape--${cornerStyle}`}>
        <input
          className="nodrag checklist-title"
          placeholder="Checklist"
          value={data.title}
          onChange={(e) => patch({ title: e.target.value })}
        />

        <div className="checklist-items">
          {data.items.map((item) => (
            <div className="checklist-row" key={item.id}>
              <input
                type="checkbox"
                className="nodrag"
                checked={item.done}
                onChange={(e) => updateItem(item.id, { done: e.target.checked })}
              />
              <input
                className={`nodrag checklist-text ${item.done ? "done" : ""}`}
                placeholder="Task"
                value={item.text}
                onChange={(e) => updateItem(item.id, { text: e.target.value })}
              />
              <input
                type="date"
                className="nodrag checklist-date"
                value={item.dueDate ?? ""}
                onChange={(e) => updateItem(item.id, { dueDate: e.target.value || null })}
              />
              <button className="nodrag checklist-remove" onClick={() => removeItem(item.id)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <button className="nodrag checklist-add" onClick={addItem}>
          + Add item
        </button>
      </div>
    </div>
  );
}
