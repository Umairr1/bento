import { createContext, useCallback, useContext } from "react";
import { useReactFlow } from "@xyflow/react";
import type { BoardSettings } from "./useYjsBoard";
import { DEFAULT_GRID_CANVAS } from "../canvas/gridBoard";

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  snapEnabled: false,
  gridSize: 130,
  showGrid: true,
  cornerStyle: "rounded",
  cornerRadius: 16,
  lockAspectRatio: false,
  gridMode: false,
  gridCanvasWidth: DEFAULT_GRID_CANVAS.width,
  gridCanvasHeight: DEFAULT_GRID_CANVAS.height,
  gridCols: DEFAULT_GRID_CANVAS.cols,
  gridRowCount: DEFAULT_GRID_CANVAS.rows,
  gridGapX: DEFAULT_GRID_CANVAS.hGap,
  gridGapY: DEFAULT_GRID_CANVAS.vGap,
  gridOuterPadding: DEFAULT_GRID_CANVAS.outerPadding,
  gridAspectRatio: "free",
  gridBgType: "solid",
  gridBackground: "#141420",
  gridBgFrom: "#2a2a55",
  gridBgTo: "#6d6bfa",
  gridBgAngle: 145,
  gridGuides: true,
  boxLabels: true,
  contentOnlySwap: false,
};

export const BoardSettingsContext = createContext<BoardSettings>(DEFAULT_BOARD_SETTINGS);

export function useBoardSettings(): BoardSettings {
  return useContext(BoardSettingsContext);
}

export function snapValue(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

type ResizeEndParams = { x: number; y: number; width: number; height: number };

/** Snaps a note's final size/position to the board grid once a resize gesture ends (if grid-snap is on). */
export function useSnapResizeEnd(id: string) {
  const { setNodes } = useReactFlow();
  const settings = useBoardSettings();

  return useCallback(
    (_event: unknown, params: ResizeEndParams) => {
      if (!settings.snapEnabled) return;
      const g = settings.gridSize;
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                position: { x: snapValue(params.x, g), y: snapValue(params.y, g) },
                width: snapValue(params.width, g),
                height: snapValue(params.height, g),
              }
            : n
        )
      );
    },
    [settings, setNodes, id]
  );
}
