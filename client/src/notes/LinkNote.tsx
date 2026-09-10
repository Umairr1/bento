import { useState, type KeyboardEvent } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { api, ApiError, resolveAssetUrl } from "../api/client";
import { useSnapResizeEnd, useBoardSettings } from "../collab/BoardSettingsContext";
import { NoteResizer } from "./NoteResizer";
import "./LinkNote.css";

export type LinkNoteData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  loading: boolean;
  error: string | null;
};

export function LinkNote({ id, data, selected }: NodeProps & { data: LinkNoteData }) {
  const { setNodes } = useReactFlow();
  const onResizeEnd = useSnapResizeEnd(id);
  const { cornerStyle, lockAspectRatio } = useBoardSettings();
  const [draft, setDraft] = useState("");

  function patch(update: Partial<LinkNoteData>) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...update } } : n)));
  }

  function remove() {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }

  async function submitUrl() {
    const value = draft.trim();
    if (!value) return;
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    patch({ url: withProtocol, loading: true, error: null });
    try {
      const preview = await api.linkPreview(withProtocol);
      patch({ ...preview, loading: false, error: null });
    } catch (err) {
      patch({ loading: false, error: err instanceof ApiError ? err.message : "Couldn't load preview" });
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submitUrl();
  }

  return (
    <div className="link-note">
      <NoteResizer
        isVisible={!!selected}
        minWidth={180}
        minHeight={90}
        onResizeEnd={onResizeEnd}
        keepAspectRatio={lockAspectRatio}
      />
      <button className="link-note-delete nodrag" onClick={remove} title="Delete note">
        ×
      </button>

      {!data.url ? (
        <div className={`link-note-empty note-shape--${cornerStyle}`}>
          <input
            className="nodrag"
            autoFocus
            placeholder="Paste a link and press Enter"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      ) : data.loading ? (
        <div className={`link-note-loading note-shape--${cornerStyle}`}>Loading preview…</div>
      ) : (
        <a
          className={`link-note-card note-shape--${cornerStyle} nodrag`}
          href={data.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
        >
          {data.image && (
            <div className="link-note-thumb">
              <img src={resolveAssetUrl(data.image)} alt="" />
            </div>
          )}
          <div className="link-note-body">
            <div className="link-note-title">{data.title ?? data.url}</div>
            {data.description && <div className="link-note-desc">{data.description}</div>}
            <div className="link-note-url">{new URL(data.url).hostname}</div>
          </div>
        </a>
      )}
    </div>
  );
}
