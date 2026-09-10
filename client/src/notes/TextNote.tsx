import type { CSSProperties } from "react";
import { useReactFlow, useViewport, type NodeProps } from "@xyflow/react";
import { useSnapResizeEnd, useBoardSettings } from "../collab/BoardSettingsContext";
import { NoteResizer } from "./NoteResizer";
import { DEFAULT_TEXT_STYLE, FONT_OPTIONS, type TextStyle, type TextAlign } from "./textStyle";
import "./TextNote.css";

export type TextNoteData = { text: string; style?: TextStyle };

export function TextNote({ id, data, selected }: NodeProps & { data: TextNoteData }) {
  const { setNodes } = useReactFlow();
  const onResizeEnd = useSnapResizeEnd(id);
  const { cornerStyle, lockAspectRatio } = useBoardSettings();
  const { zoom } = useViewport();
  const style = data.style ?? DEFAULT_TEXT_STYLE;

  function updateText(text: string) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)));
  }

  function patchStyle(update: Partial<TextStyle>) {
    setNodes((nodes) =>
      nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, style: { ...style, ...update } } } : n))
    );
  }

  function remove() {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
  }

  return (
    <div className="text-note">
      <NoteResizer
        isVisible={!!selected}
        minWidth={160}
        minHeight={100}
        onResizeEnd={onResizeEnd}
        keepAspectRatio={lockAspectRatio}
      />
      <button className="text-note-delete nodrag" onClick={remove} title="Delete note">
        ×
      </button>
      <div className={`text-note-shape note-shape--${cornerStyle}`}>
        <textarea
          className="nodrag"
          value={data.text}
          placeholder="Type something…"
          onChange={(e) => updateText(e.target.value)}
          style={{
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            textAlign: style.align,
            fontWeight: style.bold ? 700 : 400,
            fontStyle: style.italic ? "italic" : "normal",
            textDecoration: style.underline ? "underline" : "none",
          }}
        />
      </div>

      {selected && (
        <div
          className="text-note-toolbar nodrag"
          style={{ "--counter-zoom": 1 / Math.max(zoom, 0.0001) } as CSSProperties}
        >
          <select
            className="text-note-toolbar-select"
            value={style.fontFamily}
            onChange={(e) => patchStyle({ fontFamily: e.target.value })}
            title="Font"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <div className="text-note-toolbar-size">
            <button onClick={() => patchStyle({ fontSize: Math.max(8, style.fontSize - 1) })} title="Smaller">
              −
            </button>
            <span>{Math.round(style.fontSize)}</span>
            <button onClick={() => patchStyle({ fontSize: Math.min(96, style.fontSize + 1) })} title="Larger">
              +
            </button>
          </div>

          <div className="text-note-toolbar-group">
            <button
              className={style.bold ? "active" : ""}
              onClick={() => patchStyle({ bold: !style.bold })}
              title="Bold"
            >
              <b>B</b>
            </button>
            <button
              className={style.italic ? "active" : ""}
              onClick={() => patchStyle({ italic: !style.italic })}
              title="Italic"
            >
              <i>I</i>
            </button>
            <button
              className={style.underline ? "active" : ""}
              onClick={() => patchStyle({ underline: !style.underline })}
              title="Underline"
            >
              <u>U</u>
            </button>
          </div>

          <div className="text-note-toolbar-group">
            {(["left", "center", "right"] as TextAlign[]).map((a) => (
              <button
                key={a}
                className={style.align === a ? "active" : ""}
                onClick={() => patchStyle({ align: a })}
                title={`Align ${a}`}
              >
                {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
