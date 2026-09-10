import { toPng } from "html-to-image";
import type { Node } from "@xyflow/react";

const MARGIN = 40;

function computeExportBounds(nodes: Node[]) {
  const xs1 = nodes.map((n) => n.position.x);
  const ys1 = nodes.map((n) => n.position.y);
  const xs2 = nodes.map((n) => n.position.x + (n.width ?? 200));
  const ys2 = nodes.map((n) => n.position.y + (n.height ?? 150));
  const x1 = Math.min(...xs1) - MARGIN;
  const y1 = Math.min(...ys1) - MARGIN;
  const x2 = Math.max(...xs2) + MARGIN;
  const y2 = Math.max(...ys2) + MARGIN;
  return { x1, y1, width: Math.round(x2 - x1), height: Math.round(y2 - y1) };
}

export type ExportImageOptions = {
  scale: 1 | 2 | 3 | 4;
  transparent: boolean;
  filename: string;
};

/**
 * Rasterizes the board's notes (not the current on-screen pan/zoom, always the
 * full content at 1 flow-px : 1 output-px before `scale`) to a downloadable PNG.
 */
export async function exportBoardImage(
  viewportEl: HTMLElement,
  nodes: Node[],
  options: ExportImageOptions
): Promise<void> {
  if (nodes.length === 0) throw new Error("Nothing to export — add a note first");
  const bounds = computeExportBounds(nodes);

  const dataUrl = await toPng(viewportEl, {
    width: bounds.width,
    height: bounds.height,
    pixelRatio: options.scale,
    backgroundColor: options.transparent ? undefined : "#0f0f12",
    style: {
      transform: `translate(${-bounds.x1}px, ${-bounds.y1}px)`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    },
    filter: (el) => {
      if (!(el instanceof HTMLElement)) return true;
      return !el.classList?.contains("react-flow__resize-control") && !el.classList?.contains("react-flow__handle");
    },
  });

  const link = document.createElement("a");
  link.download = `${options.filename || "board"}.png`;
  link.href = dataUrl;
  link.click();
}
