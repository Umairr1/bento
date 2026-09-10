import type { DensityPreset } from "./gridBoard";

export type ShuffleSettings = {
  symmetry: number; // 0-100
  heroSize: number; // 0-100
  minWidth: number; // px (freeform mode)
  minHeight: number; // px (freeform mode)
  spacing: number; // px gap left between notes by shuffle/templates
  orientation: "balanced" | "horizontal" | "vertical";
  // Grid canvas mode only — min span is counted in CELLS there, not pixels.
  density: DensityPreset;
  minCols: number;
  minRows: number;
  seed: number;
};

export const DEFAULT_SHUFFLE_SETTINGS: ShuffleSettings = {
  symmetry: 55,
  heroSize: 30,
  minWidth: 160,
  minHeight: 120,
  spacing: 12,
  orientation: "balanced",
  density: "Balanced",
  minCols: 1,
  minRows: 1,
  seed: Math.floor(Math.random() * 900000) + 100000,
};

/** Insets a rect on all sides so adjacent shuffled/templated notes get a visible gap instead of touching edges. */
export function insetRect(r: Rect, spacing: number): Rect {
  const half = spacing / 2;
  const maxInset = Math.max(0, Math.min(half, (r.x2 - r.x1) * 0.4, (r.y2 - r.y1) * 0.4));
  return { x1: r.x1 + maxInset, y1: r.y1 + maxInset, x2: r.x2 - maxInset, y2: r.y2 - maxInset };
}

/**
 * Insets a whole batch of rects by the SAME amount, capped by whichever rect in the batch is smallest —
 * not each rect capped independently (that's what `insetRect` does per-call), which produces a smaller
 * gap around small cells than around large ones in the same layout, so the spacing looks uneven across
 * a mixed-size bento grid instead of consistent everywhere.
 */
export function insetRectsUniformly(rects: Rect[], spacing: number): Rect[] {
  const half = spacing / 2;
  let inset = half;
  for (const r of rects) {
    inset = Math.min(inset, (r.x2 - r.x1) * 0.4, (r.y2 - r.y1) * 0.4);
  }
  inset = Math.max(0, inset);
  return rects.map((r) => ({ x1: r.x1 + inset, y1: r.y1 + inset, x2: r.x2 - inset, y2: r.y2 - inset }));
}

export type Rect = { x1: number; y1: number; x2: number; y2: number };

type LayoutNode = { position: { x: number; y: number }; width?: number; height?: number };

/** Bounding area to lay notes out within — sized to fit the note count, centered on wherever the notes currently are. */
export function computeLayoutArea(nodes: LayoutNode[], minWidth: number, minHeight: number): Rect {
  const xs1 = nodes.map((n) => n.position.x);
  const ys1 = nodes.map((n) => n.position.y);
  const xs2 = nodes.map((n) => n.position.x + (n.width ?? 200));
  const ys2 = nodes.map((n) => n.position.y + (n.height ?? 150));
  const minX = Math.min(...xs1);
  const minY = Math.min(...ys1);
  const maxX = Math.max(...xs2);
  const maxY = Math.max(...ys2);
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;

  const avgArea = minWidth * 1.6 * (minHeight * 1.6);
  const neededArea = nodes.length * avgArea;
  const aspect = bboxW > 0 && bboxH > 0 ? bboxW / bboxH : 1.4;
  const areaW = Math.max(Math.sqrt(neededArea * aspect), bboxW, minWidth * 2);
  const areaH = Math.max(neededArea / Math.sqrt(neededArea * aspect), bboxH, minHeight * 2);
  const cx = bboxW > 0 ? (minX + maxX) / 2 : 0;
  const cy = bboxH > 0 ? (minY + maxY) / 2 : 0;
  return { x1: cx - areaW / 2, y1: cy - areaH / 2, x2: cx + areaW / 2, y2: cy + areaH / 2 };
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

// Deterministic PRNG so a given seed always reproduces the same arrangement.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function splitRect(rect: Rect, count: number, minW: number, minH: number, cfg: ShuffleSettings, rng: () => number): Rect[] {
  let leaves: Rect[] = [rect];
  let guard = 0;
  while (leaves.length < count && guard < 400) {
    guard++;
    const splittable = leaves
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.x2 - r.x1 >= minW * 2 || r.y2 - r.y1 >= minH * 2);
    if (!splittable.length) break;

    const pick = splittable[Math.floor(rng() * splittable.length)];
    const r = pick.r;
    const w = r.x2 - r.x1;
    const h = r.y2 - r.y1;
    const canVert = w >= minW * 2;
    const canHorz = h >= minH * 2;
    const wantVert = cfg.orientation === "horizontal" ? rng() < 0.25 : cfg.orientation === "vertical" ? rng() < 0.75 : rng() < 0.5;
    const splitVert = canVert && (wantVert || !canHorz);
    const sym = clamp(cfg.symmetry, 0, 100) / 100;
    const ratio = (0.3 + rng() * 0.4) * (1 - sym) + 0.5 * sym;

    if (splitVert) {
      const cut = clamp(r.x1 + Math.max(minW, w * ratio), r.x1 + minW, r.x2 - minW);
      leaves.splice(pick.i, 1, { x1: r.x1, y1: r.y1, x2: cut, y2: r.y2 }, { x1: cut, y1: r.y1, x2: r.x2, y2: r.y2 });
    } else if (canHorz) {
      const cut = clamp(r.y1 + Math.max(minH, h * ratio), r.y1 + minH, r.y2 - minH);
      leaves.splice(pick.i, 1, { x1: r.x1, y1: r.y1, x2: r.x2, y2: cut }, { x1: r.x1, y1: cut, x2: r.x2, y2: r.y2 });
    } else break;
  }
  return leaves;
}

// Bisects whichever leaf is currently largest, ignoring the min-size floor if needed. Guarantees
// `generateShuffleLayout` always returns exactly `count` rects tiling `area` with nothing left over —
// the min-width/min-height split above can under-produce (e.g. a thin hero side-zone that can't fit
// its allotted count), and any shortfall previously left notes stranded at their old, now-stale position.
function forceSplitToCount(leaves: Rect[], count: number): Rect[] {
  const result = leaves.slice();
  let guard = 0;
  while (result.length < count && guard < 2000) {
    guard++;
    let bestIdx = 0;
    let bestArea = -Infinity;
    for (let i = 0; i < result.length; i++) {
      const r = result[i];
      const a = (r.x2 - r.x1) * (r.y2 - r.y1);
      if (a > bestArea) {
        bestArea = a;
        bestIdx = i;
      }
    }
    const r = result[bestIdx];
    const w = r.x2 - r.x1;
    const h = r.y2 - r.y1;
    if (w <= 2 && h <= 2) break;
    if (w >= h) {
      const cut = r.x1 + w / 2;
      result.splice(bestIdx, 1, { x1: r.x1, y1: r.y1, x2: cut, y2: r.y2 }, { x1: cut, y1: r.y1, x2: r.x2, y2: r.y2 });
    } else {
      const cut = r.y1 + h / 2;
      result.splice(bestIdx, 1, { x1: r.x1, y1: r.y1, x2: r.x2, y2: cut }, { x1: r.x1, y1: cut, x2: r.x2, y2: r.y2 });
    }
  }
  return result;
}

/** Generates `count` balanced, non-overlapping rectangles tiling `area`, per bento-studio's split algorithm. */
export function generateShuffleLayout(area: Rect, count: number, settings: ShuffleSettings, seed: number): Rect[] {
  const rng = mulberry32(seed);
  const areaW = area.x2 - area.x1;
  const areaH = area.y2 - area.y1;
  const minW = Math.min(settings.minWidth, areaW / 2 || settings.minWidth);
  const minH = Math.min(settings.minHeight, areaH / 2 || settings.minHeight);
  const targetCount = Math.max(1, count);

  const heroFrac = clamp(settings.heroSize, 0, 100) / 100;
  if (heroFrac > 0.05 && targetCount > 1 && areaW > minW * 2 && areaH > minH * 2) {
    const heroW = clamp(areaW * Math.sqrt(heroFrac), minW, areaW - minW);
    const heroH = clamp(areaH * Math.sqrt(heroFrac), minH, areaH - minH);
    const corner = Math.floor(rng() * 4);
    let hero: Rect, right: Rect, bottom: Rect;
    if (corner === 0) {
      hero = { x1: area.x1, y1: area.y1, x2: area.x1 + heroW, y2: area.y1 + heroH };
      right = { x1: area.x1 + heroW, y1: area.y1, x2: area.x2, y2: area.y2 };
      bottom = { x1: area.x1, y1: area.y1 + heroH, x2: area.x1 + heroW, y2: area.y2 };
    } else if (corner === 1) {
      hero = { x1: area.x2 - heroW, y1: area.y1, x2: area.x2, y2: area.y1 + heroH };
      right = { x1: area.x1, y1: area.y1, x2: area.x2 - heroW, y2: area.y2 };
      bottom = { x1: area.x2 - heroW, y1: area.y1 + heroH, x2: area.x2, y2: area.y2 };
    } else if (corner === 2) {
      hero = { x1: area.x1, y1: area.y2 - heroH, x2: area.x1 + heroW, y2: area.y2 };
      right = { x1: area.x1 + heroW, y1: area.y1, x2: area.x2, y2: area.y2 };
      bottom = { x1: area.x1, y1: area.y1, x2: area.x1 + heroW, y2: area.y2 - heroH };
    } else {
      hero = { x1: area.x2 - heroW, y1: area.y2 - heroH, x2: area.x2, y2: area.y2 };
      right = { x1: area.x1, y1: area.y1, x2: area.x2 - heroW, y2: area.y2 };
      bottom = { x1: area.x2 - heroW, y1: area.y1, x2: area.x2, y2: area.y2 - heroH };
    }
    const remaining = Math.max(1, targetCount - 1);
    const rightArea = Math.max(0, right.x2 - right.x1) * Math.max(0, right.y2 - right.y1);
    const bottomArea = Math.max(0, bottom.x2 - bottom.x1) * Math.max(0, bottom.y2 - bottom.y1);
    const totalArea = rightArea + bottomArea || 1;
    const rightCount = rightArea > 0 ? Math.max(1, Math.round((remaining * rightArea) / totalArea)) : 0;
    const bottomCount = bottomArea > 0 ? Math.max(1, remaining - rightCount) : 0;

    let leaves = [hero];
    if (rightArea > 0) leaves = leaves.concat(splitRect(right, rightCount, minW, minH, settings, rng));
    if (bottomArea > 0) leaves = leaves.concat(splitRect(bottom, bottomCount, minW, minH, settings, rng));
    if (leaves.length < targetCount) leaves = forceSplitToCount(leaves, targetCount);
    return leaves.slice(0, targetCount);
  }

  let leaves = splitRect(area, targetCount, minW, minH, settings, rng);
  if (leaves.length < targetCount) leaves = forceSplitToCount(leaves, targetCount);
  return leaves.slice(0, targetCount);
}
