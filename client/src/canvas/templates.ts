export type TemplateId =
  | "equalGrid"
  | "heroSupport"
  | "largeLeft"
  | "largeRight"
  | "largeTop"
  | "largeBottom"
  | "editorial"
  | "dashboard"
  | "mosaic"
  | "verticalSocial"
  | "presentation"
  | "threeColumns"
  | "threeRows"
  | "quadStrip"
  | "sidebarLeft"
  | "sidebarRight"
  | "magazineSpread"
  | "featureRow"
  | "quilt";

export const TEMPLATES: { id: TemplateId; name: string }[] = [
  { id: "equalGrid", name: "Equal grid" },
  { id: "heroSupport", name: "Hero + support" },
  { id: "largeLeft", name: "Large left" },
  { id: "largeRight", name: "Large right" },
  { id: "largeTop", name: "Large top" },
  { id: "largeBottom", name: "Large bottom" },
  { id: "editorial", name: "Editorial" },
  { id: "dashboard", name: "Dashboard" },
  { id: "mosaic", name: "Mosaic" },
  { id: "verticalSocial", name: "Vertical social" },
  { id: "presentation", name: "Presentation" },
  { id: "threeColumns", name: "Three columns" },
  { id: "threeRows", name: "Three rows" },
  { id: "quadStrip", name: "Quad strip" },
  { id: "sidebarLeft", name: "Sidebar left" },
  { id: "sidebarRight", name: "Sidebar right" },
  { id: "magazineSpread", name: "Magazine spread" },
  { id: "featureRow", name: "Feature row" },
  { id: "quilt", name: "Quilt" },
];

// [x, y, w, h] as fractions (0-1) of the target area. The bento-studio-ported ones (heroSupport
// through presentation) are verbatim from its TEMPLATE_DEFS; the rest are new additions.
export type FracRect = [number, number, number, number];

const TEMPLATE_DEFS: Partial<Record<TemplateId, FracRect[]>> = {
  heroSupport: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 0.34], [0.62, 0.34, 0.38, 0.33], [0.62, 0.67, 0.38, 0.33]],
  largeLeft: [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]],
  largeRight: [[0, 0, 0.4, 0.5], [0, 0.5, 0.4, 0.5], [0.4, 0, 0.6, 1]],
  largeTop: [[0, 0, 1, 0.55], [0, 0.55, 0.5, 0.45], [0.5, 0.55, 0.5, 0.45]],
  largeBottom: [[0, 0, 0.5, 0.45], [0.5, 0, 0.5, 0.45], [0, 0.45, 1, 0.55]],
  editorial: [
    [0, 0, 0.66, 0.6],
    [0.66, 0, 0.34, 0.3],
    [0.66, 0.3, 0.34, 0.3],
    [0, 0.6, 0.33, 0.4],
    [0.33, 0.6, 0.33, 0.4],
    [0.66, 0.6, 0.34, 0.4],
  ],
  dashboard: [
    [0, 0, 0.25, 0.5],
    [0, 0.5, 0.25, 0.5],
    [0.25, 0, 0.5, 0.33],
    [0.25, 0.33, 0.5, 0.34],
    [0.25, 0.67, 0.5, 0.33],
    [0.75, 0, 0.25, 0.5],
    [0.75, 0.5, 0.25, 0.5],
  ],
  mosaic: [
    [0, 0, 0.33, 0.33],
    [0.33, 0, 0.34, 0.33],
    [0.67, 0, 0.33, 0.33],
    [0, 0.33, 0.5, 0.34],
    [0.5, 0.33, 0.5, 0.34],
    [0, 0.67, 0.33, 0.33],
    [0.33, 0.67, 0.34, 0.33],
    [0.67, 0.67, 0.33, 0.33],
  ],
  verticalSocial: [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.25], [0.5, 0.5, 0.5, 0.25], [0, 0.75, 0.5, 0.25], [0.5, 0.75, 0.5, 0.25]],
  presentation: [[0.08, 0.08, 0.84, 0.6], [0.08, 0.7, 0.26, 0.22], [0.37, 0.7, 0.26, 0.22], [0.66, 0.7, 0.26, 0.22]],

  threeColumns: [
    [0, 0, 1 / 3, 1],
    [1 / 3, 0, 1 / 3, 1],
    [2 / 3, 0, 1 / 3, 1],
  ],
  threeRows: [
    [0, 0, 1, 1 / 3],
    [0, 1 / 3, 1, 1 / 3],
    [0, 2 / 3, 1, 1 / 3],
  ],
  quadStrip: [
    [0, 0, 0.25, 1],
    [0.25, 0, 0.25, 1],
    [0.5, 0, 0.25, 1],
    [0.75, 0, 0.25, 1],
  ],
  sidebarLeft: [
    [0, 0, 0.22, 1],
    [0.22, 0, 0.78, 0.5],
    [0.22, 0.5, 0.78, 0.5],
  ],
  sidebarRight: [
    [0, 0, 0.78, 0.5],
    [0, 0.5, 0.78, 0.5],
    [0.78, 0, 0.22, 1],
  ],
  magazineSpread: [
    [0, 0, 0.5, 1],
    [0.5, 0, 0.5, 0.55],
    [0.5, 0.55, 0.25, 0.45],
    [0.75, 0.55, 0.25, 0.45],
  ],
  featureRow: [
    [0, 0, 1, 0.35],
    [0, 0.35, 0.25, 0.65],
    [0.25, 0.35, 0.25, 0.65],
    [0.5, 0.35, 0.25, 0.65],
    [0.75, 0.35, 0.25, 0.65],
  ],
  quilt: [
    [0, 0, 0.6, 0.65],
    [0, 0.65, 0.3, 0.35],
    [0.3, 0.65, 0.3, 0.35],
    [0.6, 0, 0.4, 1 / 3],
    [0.6, 1 / 3, 0.4, 1 / 3],
    [0.6, 2 / 3, 0.4, 1 / 3],
  ],
};

// Divides count cells into rows sized to fill the full 0-1 width/height every time: a row's cells are
// each 1/colsInRow wide (not 1/cols), so an incomplete last row stretches to fill the width instead of
// leaving a gap on one side.
function equalGridFracs(count: number): FracRect[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const fracs: FracRect[] = [];
  let placed = 0;
  for (let row = 0; row < rows; row++) {
    const colsInRow = Math.min(cols, count - placed);
    for (let col = 0; col < colsInRow; col++) {
      fracs.push([col / colsInRow, row / rows, 1 / colsInRow, 1 / rows]);
      placed++;
    }
  }
  return fracs;
}

// Rescales a set of fractional rects so their combined bounding box spans the full 0-1 area on both
// axes, instead of stopping short wherever cells happen to have been dropped or added.
function normalizeToFullArea(fracs: FracRect[]): FracRect[] {
  if (!fracs.length) return fracs;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [fx, fy, fw, fh] of fracs) {
    minX = Math.min(minX, fx);
    minY = Math.min(minY, fy);
    maxX = Math.max(maxX, fx + fw);
    maxY = Math.max(maxY, fy + fh);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return fracs.map(([fx, fy, fw, fh]) => [(fx - minX) / spanX, (fy - minY) / spanY, fw / spanX, fh / spanY]);
}

/**
 * Returns exactly `count` fractional rects (or as many as fit) for the template, always tiling the
 * full 0-1 area on both axes — left-to-right and top-to-bottom — with no leftover strip on any side,
 * whether `count` is under, over, or exactly the template's own cell count.
 */
export function templateRectsForCount(id: TemplateId, count: number): FracRect[] {
  if (id === "equalGrid") return equalGridFracs(count);

  const base = TEMPLATE_DEFS[id] ?? [];
  if (base.length === 0) return [];
  if (count === base.length) return base;
  if (count < base.length) return normalizeToFullArea(base.slice(0, count));

  const repeats = Math.ceil(count / base.length);
  const tileCols = Math.max(1, Math.ceil(Math.sqrt(repeats)));
  const tileRows = Math.max(1, Math.ceil(repeats / tileCols));

  const rects: FracRect[] = [];
  let tilesPlaced = 0;
  for (let r = 0; r < tileRows && rects.length < count; r++) {
    const colsInRow = Math.min(tileCols, repeats - tilesPlaced);
    const tileW = 1 / colsInRow;
    const tileH = 1 / tileRows;
    for (let c = 0; c < colsInRow && rects.length < count; c++) {
      const originX = c * tileW;
      const originY = r * tileH;
      tilesPlaced++;
      // A tile that can't hold the whole pattern gets a normalized partial pattern (recursing into
      // the count < base.length branch above) so it still fills its own slot completely, rather than
      // a raw truncated slice of base cells that would leave a hole wherever the cut landed.
      const remaining = count - rects.length;
      const cellsForThisTile = Math.min(base.length, remaining);
      const tileFracs = cellsForThisTile === base.length ? base : templateRectsForCount(id, cellsForThisTile);
      for (const [fx, fy, fw, fh] of tileFracs) {
        rects.push([originX + fx * tileW, originY + fy * tileH, fw * tileW, fh * tileH]);
      }
    }
  }
  return rects;
}

export function fracRectToArea(f: FracRect, area: { x1: number; y1: number; x2: number; y2: number }) {
  const [fx, fy, fw, fh] = f;
  const areaW = area.x2 - area.x1;
  const areaH = area.y2 - area.y1;
  return {
    x1: area.x1 + fx * areaW,
    y1: area.y1 + fy * areaH,
    x2: area.x1 + (fx + fw) * areaW,
    y2: area.y1 + (fy + fh) * areaH,
  };
}
