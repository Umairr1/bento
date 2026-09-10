import { useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import "./ShortcutsHelp.css";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
const MOD = isMac ? "⌘" : "Ctrl";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: `${MOD} Z`, label: "Undo" },
  { keys: `${MOD} Shift Z`, label: "Redo" },
  { keys: `${MOD} A`, label: "Select all notes" },
  { keys: `${MOD} C`, label: "Copy selected" },
  { keys: `${MOD} V`, label: "Paste" },
  { keys: `${MOD} D`, label: "Duplicate selected" },
  { keys: `${MOD} F`, label: "Search notes on this board" },
  { keys: "Alt + drag", label: "Drag a note to duplicate it" },
  { keys: "Shift + click", label: "Add a note to the selection" },
  { keys: "Shift + drag (empty canvas)", label: "Rubber-band select multiple notes" },
  { keys: "Right-click a note", label: "Lock, tag, duplicate or delete it" },
  { keys: "Arrow keys", label: "Nudge selected note(s) 1px (Shift = 10px)" },
  { keys: "Delete / Backspace", label: "Delete selected note(s)" },
  { keys: "Escape", label: "Deselect / close popups" },
  { keys: "Space", label: "Play / pause (in Presentation)" },
  { keys: "← →", label: "Previous / next slide (in Presentation)" },
];

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const panelWidth = 300;
    const left = Math.min(rect.left, window.innerWidth - panelWidth - 12);
    setPos({ top: rect.bottom + 8, left: Math.max(12, left) });
  }, [open]);

  return (
    <div className="shortcuts-help">
      <button ref={btnRef} className="shortcuts-help-btn" onClick={() => setOpen((v) => !v)} title="Keyboard & mouse shortcuts">
        i
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="shortcuts-help-backdrop" onClick={() => setOpen(false)} />
            <div className="shortcuts-help-panel" style={{ top: pos.top, left: pos.left }}>
              <div className="shortcuts-help-header">
                <span>Shortcuts</span>
                <button onClick={() => setOpen(false)} title="Close">
                  ×
                </button>
              </div>
              <ul className="shortcuts-help-list">
                {SHORTCUTS.map((s) => (
                  <li key={s.keys}>
                    <kbd>{s.keys}</kbd>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
