// Ported to match Bento Studio's actual grid model exactly (read directly from its source): a FIXED-SIZE
// canvas (width x height) divided into `cols` x `rows` UNIFORM cells (all the same size — there is no
// per-column/per-row track sizing). A note occupies a rectangular span of whole cells. Resizing changes
// only that note's own span (dragging an edge grows/shrinks how many cells it covers); it never touches
// any other note, and is simply rejected (rubber-banded back) if the new span would overlap one.

export type GridCanvasSettings = {
  width: number;
  height: number;
  cols: number;
  rows: number;
  hGap: number;
  vGap: number;
  outerPadding: number;
};

/** Upper bound for the column/row count — beyond this the cells get too small to be useful. */
export const MAX_GRID_TRACKS = 10;

export const DEFAULT_GRID_CANVAS: GridCanvasSettings = {
  width: 1500,
  height: 1500,
  cols: 6,
  rows: 6,
  hGap: 24,
  vGap: 24,
  outerPadding: 42,
};

export type GridMetrics = { cellW: number; cellH: number; pad: number; hGap: number; vGap: number };

export function computeMetrics(g: GridCanvasSettings): GridMetrics {
  const cellW = (g.width - g.outerPadding * 2 - g.hGap * (g.cols - 1)) / g.cols;
  const cellH = (g.height - g.outerPadding * 2 - g.vGap * (g.rows - 1)) / g.rows;
  return { cellW, cellH, pad: g.outerPadding, hGap: g.hGap, vGap: g.vGap };
}

/** A rectangular span of whole cells, col2/row2 exclusive (a 1x1 box at the origin is {0,0,1,1}). */
export type CellSpan = { col1: number; row1: number; col2: number; row2: number };

export function spanToRect(span: CellSpan, m: GridMetrics) {
  const left = m.pad + span.col1 * (m.cellW + m.hGap);
  const top = m.pad + span.row1 * (m.cellH + m.vGap);
  const width = (span.col2 - span.col1) * m.cellW + (span.col2 - span.col1 - 1) * m.hGap;
  const height = (span.row2 - span.row1) * m.cellH + (span.row2 - span.row1 - 1) * m.vGap;
  return { x: left, y: top, w: width, h: height };
}

export function spansOverlap(a: CellSpan, b: CellSpan): boolean {
  return a.col1 < b.col2 && a.col2 > b.col1 && a.row1 < b.row2 && a.row2 > b.row1;
}

export function overlapsAny(span: CellSpan, others: CellSpan[]): boolean {
  return others.some((o) => spansOverlap(span, o));
}

/** True when `inner` sits entirely inside `outer` — i.e. growing to `outer` would fully swallow it. */
export function spanContains(outer: CellSpan, inner: CellSpan): boolean {
  return inner.col1 >= outer.col1 && inner.col2 <= outer.col2 && inner.row1 >= outer.row1 && inner.row2 <= outer.row2;
}

/** First free 1x1 cell, scanning row-major; extends past `rows` if the grid is completely full. */
export function findFreeSpan(occupied: CellSpan[], cols: number, rows: number): CellSpan {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const candidate: CellSpan = { col1: c, row1: r, col2: c + 1, row2: r + 1 };
      if (!overlapsAny(candidate, occupied)) return candidate;
    }
  }
  return { col1: 0, row1: rows, col2: 1, row2: rows + 1 };
}

export type ResizeDir = "n" | "s" | "e" | "w";

/**
 * Grows/shrinks `span` by `deltaCells` from the given edge, clamped to the grid bounds and to staying
 * at least 1 cell in that axis — direct port of Bento's onMove handler in startResize.
 */
export function resizeSpan(span: CellSpan, dir: ResizeDir, deltaCells: number, cols: number, rows: number): CellSpan {
  const next = { ...span };
  if (dir === "e") next.col2 = clamp(span.col2 + deltaCells, next.col1 + 1, cols);
  if (dir === "w") next.col1 = clamp(span.col1 + deltaCells, 0, next.col2 - 1);
  if (dir === "s") next.row2 = clamp(span.row2 + deltaCells, next.row1 + 1, rows);
  if (dir === "n") next.row1 = clamp(span.row1 + deltaCells, 0, next.row2 - 1);
  return next;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/* ===================== cell-space shuffle (ported from bento-studio's shuffleLayout) ===================== */

export type DensityPreset = "Minimal" | "Light" | "Balanced" | "Dense" | "Max";

export const DENSITY_RANGES: Record<DensityPreset, [number, number]> = {
  Minimal: [4, 5],
  Light: [6, 7],
  Balanced: [8, 10],
  Dense: [11, 14],
  Max: [15, 18],
};

export const DENSITY_PRESETS: DensityPreset[] = ["Minimal", "Light", "Balanced", "Dense", "Max"];

export type GridShuffleSettings = {
  density: DensityPreset;
  symmetry: number; // 0-100
  heroSize: number; // 0-100
  minCols: number; // in cells
  minRows: number; // in cells
  orientation: "balanced" | "horizontal" | "vertical";
};

// Deterministic PRNG so a given seed always reproduces the same layout.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Recursively splits the whole grid into `count` non-overlapping cell spans — the generator behind
 * bento's "balanced boxes". `targetCount` overrides the density-derived count, which is how Boards
 * re-shuffles an existing set of notes without creating or destroying any of them.
 */
export function shuffleGridLayout(
  cols: number,
  rows: number,
  cfg: GridShuffleSettings,
  opts: { seed?: number; lockedSpans?: CellSpan[]; targetCount?: number } = {}
): CellSpan[] {
  const rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 900000) + 100000);
  const minW = clamp(cfg.minCols, 1, cols);
  const minH = clamp(cfg.minRows, 1, rows);
  const lockedSpans = opts.lockedSpans ?? [];

  const maxPossible = Math.max(2, Math.floor((cols * rows) / (minW * minH)));
  const range = DENSITY_RANGES[cfg.density] ?? DENSITY_RANGES.Balanced;
  const densityCount = range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
  const targetCount = clamp(opts.targetCount ?? densityCount, 1, maxPossible);

  function splitRect(rect: CellSpan, count: number): CellSpan[] {
    const leaves: CellSpan[] = [rect];
    let guard = 0;
    while (leaves.length < count && guard < 400) {
      guard++;
      const splittable = leaves
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.col2 - r.col1 >= minW * 2 || r.row2 - r.row1 >= minH * 2);
      if (!splittable.length) break;

      const pick = splittable[Math.floor(rng() * splittable.length)];
      const r = pick.r;
      const w = r.col2 - r.col1;
      const h = r.row2 - r.row1;
      const canVert = w >= minW * 2;
      const canHorz = h >= minH * 2;
      const wantVert = cfg.orientation === "horizontal" ? rng() < 0.25 : cfg.orientation === "vertical" ? rng() < 0.75 : rng() < 0.5;
      const splitVert = canVert && (wantVert || !canHorz);
      const sym = clamp(cfg.symmetry, 0, 100) / 100;
      const ratio = (0.3 + rng() * 0.4) * (1 - sym) + 0.5 * sym;

      if (splitVert) {
        const cut = clamp(r.col1 + Math.max(minW, Math.round(w * ratio)), r.col1 + minW, r.col2 - minW);
        leaves.splice(pick.i, 1, { col1: r.col1, row1: r.row1, col2: cut, row2: r.row2 }, { col1: cut, row1: r.row1, col2: r.col2, row2: r.row2 });
      } else if (canHorz) {
        const cut = clamp(r.row1 + Math.max(minH, Math.round(h * ratio)), r.row1 + minH, r.row2 - minH);
        leaves.splice(pick.i, 1, { col1: r.col1, row1: r.row1, col2: r.col2, row2: cut }, { col1: r.col1, row1: cut, col2: r.col2, row2: r.row2 });
      } else break;
    }
    return leaves;
  }

  let leaves: CellSpan[];
  const heroFrac = clamp(cfg.heroSize, 0, 100) / 100;
  if (heroFrac > 0.05 && targetCount > 1 && cols > minW * 2 && rows > minH * 2) {
    const heroW = clamp(Math.round(cols * Math.sqrt(heroFrac)), minW, cols - minW);
    const heroH = clamp(Math.round(rows * Math.sqrt(heroFrac)), minH, rows - minH);
    const corner = Math.floor(rng() * 4);
    let hero: CellSpan, rightStrip: CellSpan, bottomStrip: CellSpan;
    if (corner === 0) {
      hero = { col1: 0, row1: 0, col2: heroW, row2: heroH };
      rightStrip = { col1: heroW, row1: 0, col2: cols, row2: rows };
      bottomStrip = { col1: 0, row1: heroH, col2: heroW, row2: rows };
    } else if (corner === 1) {
      hero = { col1: cols - heroW, row1: 0, col2: cols, row2: heroH };
      rightStrip = { col1: 0, row1: 0, col2: cols - heroW, row2: rows };
      bottomStrip = { col1: cols - heroW, row1: heroH, col2: cols, row2: rows };
    } else if (corner === 2) {
      hero = { col1: 0, row1: rows - heroH, col2: heroW, row2: rows };
      rightStrip = { col1: heroW, row1: 0, col2: cols, row2: rows };
      bottomStrip = { col1: 0, row1: 0, col2: heroW, row2: rows - heroH };
    } else {
      hero = { col1: cols - heroW, row1: rows - heroH, col2: cols, row2: rows };
      rightStrip = { col1: 0, row1: 0, col2: cols - heroW, row2: rows };
      bottomStrip = { col1: cols - heroW, row1: 0, col2: cols, row2: rows - heroH };
    }
    const remaining = Math.max(1, targetCount - 1);
    const rightArea = Math.max(0, rightStrip.col2 - rightStrip.col1) * Math.max(0, rightStrip.row2 - rightStrip.row1);
    const bottomArea = Math.max(0, bottomStrip.col2 - bottomStrip.col1) * Math.max(0, bottomStrip.row2 - bottomStrip.row1);
    const totalArea = rightArea + bottomArea || 1;
    const rightCount = rightArea > 0 ? Math.max(1, Math.round((remaining * rightArea) / totalArea)) : 0;
    const bottomCount = bottomArea > 0 ? Math.max(1, remaining - rightCount) : 0;
    leaves = [hero];
    if (rightArea > 0) leaves = leaves.concat(splitRect(rightStrip, rightCount));
    if (bottomArea > 0) leaves = leaves.concat(splitRect(bottomStrip, bottomCount));
  } else {
    leaves = splitRect({ col1: 0, row1: 0, col2: cols, row2: rows }, targetCount);
  }

  if (lockedSpans.length) {
    leaves = leaves.filter((r) => !overlapsAny(r, lockedSpans));
  }
  return leaves;
}

// A fixed seed/config so every new grid board opens on the same designed-looking bento starter
// (hero + supports, full 48-cell coverage at the default 6x8) rather than an empty canvas.
export const DEFAULT_GRID_TEMPLATE = {
  seed: 66,
  cfg: {
    density: "Light" as DensityPreset,
    symmetry: 55,
    heroSize: 40,
    minCols: 1,
    minRows: 1,
    orientation: "balanced" as const,
  },
};

export type AspectRatioPreset =
  | "free"
  | "1:1"
  | "4:5"
  | "3:4"
  | "2:3"
  | "9:16"
  | "16:9"
  | "3:2"
  | "4:3"
  | "5:4"
  | "21:9";

export const ASPECT_RATIO_OPTIONS: { id: AspectRatioPreset; label: string; ratio: number | null }[] = [
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1 — Square post", ratio: 1 },
  { id: "4:5", label: "4:5 — Portrait post", ratio: 5 / 4 },
  { id: "3:4", label: "3:4 — Portrait", ratio: 4 / 3 },
  { id: "2:3", label: "2:3 — Poster", ratio: 3 / 2 },
  { id: "9:16", label: "9:16 — Story / Reel", ratio: 16 / 9 },
  { id: "16:9", label: "16:9 — Widescreen", ratio: 9 / 16 },
  { id: "3:2", label: "3:2 — Photo", ratio: 2 / 3 },
  { id: "4:3", label: "4:3 — Classic", ratio: 3 / 4 },
  { id: "5:4", label: "5:4 — Print", ratio: 4 / 5 },
  { id: "21:9", label: "21:9 — Cinematic", ratio: 9 / 21 },
];

/** height = width * ratio, keeping the current width fixed — a one-shot "set canvas to this shape". */
export function applyAspectRatio(width: number, ratio: number): number {
  return Math.round(width * ratio);
}

/** Ported from bento's backgroundCss(): the fill behind the grid, shown in the gaps between cells. */
export function gridBackgroundCss(s: {
  gridBgType: "solid" | "gradient" | "transparent";
  gridBackground: string;
  gridBgFrom: string;
  gridBgTo: string;
  gridBgAngle: number;
}): string {
  if (s.gridBgType === "transparent") return "repeating-conic-gradient(#1c1c20 0% 25%, #131316 0% 50%) 0 0/20px 20px";
  if (s.gridBgType === "gradient") return `linear-gradient(${s.gridBgAngle}deg, ${s.gridBgFrom} 0%, ${s.gridBgTo} 100%)`;
  return s.gridBackground;
}
