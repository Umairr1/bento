import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { api, ApiError } from "../api/client";
import { useSnapResizeEnd, useBoardSettings } from "../collab/BoardSettingsContext";
import { NoteResizer } from "./NoteResizer";
import "./BoardNote.css";

export type BoardNoteData = {
  parentBoardId: number;
  boardId: number | null;
  title: string;
  creating: boolean;
  error: string | null;
};

export function BoardNote({ id, data, selected }: NodeProps & { data: BoardNoteData }) {
  const { setNodes } = useReactFlow();
  const onResizeEnd = useSnapResizeEnd(id);
  const { cornerStyle, lockAspectRatio } = useBoardSettings();
  const [draft, setDraft] = useState("");

  function patch(update: Partial<BoardNoteData>) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...update } } : n)));
  }

  async function submitTitle() {
    const value = draft.trim();
    if (!value) return;
    patch({ creating: true, error: null });
    try {
      const board = await api.createSubboard(data.parentBoardId, value);
      patch({ boardId: board.id, title: board.title, creating: false });
    } catch (err) {
      patch({ creating: false, error: err instanceof ApiError ? err.message : "Couldn't create board" });
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submitTitle();
  }

  async function remove() {
    if (data.boardId) {
      if (!confirm(`Delete "${data.title}" and everything inside it? This can't be undone.`)) return;
      try {
        await api.deleteBoard(data.boardId);
      } catch {
        // fall through and remove the note either way — board may already be gone
      }
    }
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }

  return (
    <div className="board-note">
      <NoteResizer
        isVisible={!!selected}
        minWidth={160}
        minHeight={90}
        onResizeEnd={onResizeEnd}
        keepAspectRatio={lockAspectRatio}
      />
      <button className="board-note-delete nodrag" onClick={remove} title="Delete board">
        ×
      </button>

      {data.boardId ? (
        <Link className={`board-note-card note-shape--${cornerStyle} nodrag`} to={`/board/${data.boardId}`}>
          <span className="board-note-icon">▦</span>
          <span className="board-note-title">{data.title}</span>
          <span className="board-note-open">Open →</span>
        </Link>
      ) : (
        <div className={`board-note-empty note-shape--${cornerStyle}`}>
          <input
            className="nodrag"
            autoFocus
            placeholder="New board title…"
            value={draft}
            disabled={data.creating}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {data.creating && <span className="board-note-status">Creating…</span>}
          {data.error && <span className="board-note-error">{data.error}</span>}
        </div>
      )}
    </div>
  );
}
