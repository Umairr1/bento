import { NodeResizeControl, ResizeControlVariant, type ControlPosition } from "@xyflow/react";
import { useBoardSettings } from "../collab/BoardSettingsContext";

const HANDLE_POSITIONS: ControlPosition[] = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
];
const LINE_POSITIONS: ControlPosition[] = ["top", "right", "bottom", "left"];
const GRID_PILL_POSITIONS: ControlPosition[] = ["top", "right", "bottom", "left"];

type NoteResizerProps = {
  isVisible: boolean;
  minWidth: number;
  minHeight: number;
  keepAspectRatio?: boolean;
  onResizeEnd?: (event: unknown, params: { x: number; y: number; width: number; height: number }) => void;
};

/** Same as React Flow's <NodeResizer>, but with a visible drag handle at every edge midpoint too, not just corners. */
export function NoteResizer({ isVisible, minWidth, minHeight, keepAspectRatio, onResizeEnd }: NoteResizerProps) {
  const { gridMode } = useBoardSettings();

  // Grid canvas mode drags a row/column TRACK, not a corner (a corner drag would touch two tracks at
  // once and read as ambiguous), so it only exposes the four edge-midpoint handles — sized as large
  // pills, matching Bento Studio's grid resize handles — and skips the thin line-drag zones entirely.
  // Always rendered and shown/hidden purely in CSS on hover-or-selected, the way bento does it
  // (`.box.selected .handle, .box:hover .handle`), so they appear on hover without clicking first.
  if (gridMode) {
    return (
      <>
        {GRID_PILL_POSITIONS.map((position) => {
          const vertical = position === "top" || position === "bottom";
          return (
            <NodeResizeControl
              key={`grid-pill-${position}`}
              position={position}
              variant={ResizeControlVariant.Handle}
              minWidth={minWidth}
              minHeight={minHeight}
              onResizeEnd={onResizeEnd}
              style={{
                background: "#fff",
                border: "1px solid rgba(0,0,0,.25)",
                boxShadow: "0 1px 3px rgba(0,0,0,.35)",
                width: vertical ? 44 : 18,
                height: vertical ? 18 : 44,
                borderRadius: 9,
                zIndex: 10,
              }}
              className="nodrag grid-resize-pill"
            />
          );
        })}
      </>
    );
  }

  if (!isVisible) return null;

  return (
    <>
      {LINE_POSITIONS.map((position) => (
        <NodeResizeControl
          key={`line-${position}`}
          position={position}
          variant={ResizeControlVariant.Line}
          minWidth={minWidth}
          minHeight={minHeight}
          keepAspectRatio={keepAspectRatio}
          onResizeEnd={onResizeEnd}
          style={{ borderColor: "#6d6bfa" }}
          className="nodrag"
        />
      ))}
      {HANDLE_POSITIONS.map((position) => (
        <NodeResizeControl
          key={`handle-${position}`}
          position={position}
          variant={ResizeControlVariant.Handle}
          minWidth={minWidth}
          minHeight={minHeight}
          keepAspectRatio={keepAspectRatio}
          onResizeEnd={onResizeEnd}
          style={{ background: "#6d6bfa", width: 8, height: 8, borderRadius: 2 }}
          className="nodrag"
        />
      ))}
    </>
  );
}
