import { createContext, useContext, type ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import "./NoteChrome.css";

export type NoteChromeInfo = { tagColor?: string; locked?: boolean; matched?: boolean; current?: boolean; gridLabel?: string };

export const NoteChromeContext = createContext<Map<string, NoteChromeInfo>>(new Map());

/** Per-note actions surfaced by the hover toolbar (bento's .b-toolbar). */
export type NoteActions = {
  onReplaceMedia: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export const NoteActionsContext = createContext<NoteActions | null>(null);

const ICON = {
  image: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  lock: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  unlock: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.6-1.5" />
    </svg>
  ),
  duplicate: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  close: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
};

export function withNoteChrome<P extends NodeProps>(Component: ComponentType<P>): ComponentType<P> {
  return function ChromedNote(props: P) {
    const chromeMap = useContext(NoteChromeContext);
    const actions = useContext(NoteActionsContext);
    const chrome = chromeMap.get(props.id);
    const locked = !!chrome?.locked;

    const stop = (fn: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      fn();
    };

    return (
      <div
        className={`note-chrome ${chrome?.matched ? "note-chrome--matched" : ""} ${
          chrome?.current ? "note-chrome--current" : ""
        } ${locked ? "note-chrome--locked" : ""}`}
      >
        <Component {...props} />
        {chrome?.gridLabel && <span className="note-chrome-grid-label">{chrome.gridLabel}</span>}
        {chrome?.tagColor && <span className="note-chrome-tag" style={{ background: chrome.tagColor }} />}
        {locked && (
          <span className="note-chrome-lock" title="Locked in place">
            {ICON.lock}
          </span>
        )}
        {actions && (
          <div className="note-chrome-toolbar nodrag">
            <button className="nc-tbtn" title="Replace media" onClick={stop(() => actions.onReplaceMedia(props.id))}>
              {ICON.image}
            </button>
            <button
              className="nc-tbtn"
              title={locked ? "Unlock" : "Lock (protects from Shuffle)"}
              onClick={stop(() => actions.onToggleLock(props.id))}
            >
              {locked ? ICON.unlock : ICON.lock}
            </button>
            <button className="nc-tbtn" title="Duplicate" onClick={stop(() => actions.onDuplicate(props.id))}>
              {ICON.duplicate}
            </button>
            <button className="nc-tbtn nc-tbtn--danger" title="Delete" onClick={stop(() => actions.onDelete(props.id))}>
              {ICON.close}
            </button>
          </div>
        )}
      </div>
    );
  };
}
