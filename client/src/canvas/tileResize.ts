export type TileRect = { x: number; y: number; w: number; h: number };

const EDGE_TOLERANCE_DEFAULT = 20;
const MIN_SIZE_DEFAULT = 60;
const MIN_SEED_OVERLAP_DEFAULT = 20;

// True when two spans overlap by any amount, or are separated by a gap no bigger than `tolerance` —
// i.e. they're touching or effectively touching.
function connected(a1: number, a2: number, b1: number, b2: number, tolerance: number): boolean {
  return b1 - a2 <= tolerance && a1 - b2 <= tolerance;
}

function overlapAmount(a1: number, a2: number, b1: number, b2: number): number {
  return Math.min(a2, b2) - Math.max(a1, b1);
}

// Flood-fills along a seam (a shared x or y coordinate) to collect every rect that belongs to the same
// grid line as the resized rect. This runs in two tiers, because two different notions of "connected"
// are both needed and neither alone is safe:
//
// - The direct/"seed" pass requires a REAL overlap with the resized rect's own span, not just a nearby
//   edge coordinate. Without this, a totally unrelated rect in a different column/row can have an edge
//   that lands within tolerance purely by coincidence (two different branches of an irregular bento
//   split can end up a few px apart for no structural reason) and get dragged along with a resize it
//   has nothing to do with.
// - The transitive pass, once a rect is confirmed via the seed check, allows plain touching (zero
//   overlap) to bring in rects stacked further along the *same* confirmed seam — e.g. two notes stacked
//   in one column, only the nearer one overlaps the resized note directly, but the farther one still
//   needs to move to keep that whole column's boundary flush.
function collectSeamNeighbors(
  rects: Map<string, TileRect>,
  excludeId: string,
  seamCoord: number,
  edgeOf: (r: TileRect) => number,
  spanOf: (r: TileRect) => [number, number],
  seedSpan: [number, number],
  tolerance: number,
  minSeedOverlap: number
): Set<string> {
  const matched = new Set<string>();
  const covered: [number, number][] = [seedSpan];

  for (const [id, r] of rects) {
    if (id === excludeId) continue;
    if (Math.abs(edgeOf(r) - seamCoord) > tolerance) continue;
    const [s1, s2] = spanOf(r);
    if (overlapAmount(seedSpan[0], seedSpan[1], s1, s2) >= minSeedOverlap) {
      matched.add(id);
      covered.push([s1, s2]);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, r] of rects) {
      if (id === excludeId || matched.has(id)) continue;
      if (Math.abs(edgeOf(r) - seamCoord) > tolerance) continue;
      const [s1, s2] = spanOf(r);
      const hits = covered.some(([c1, c2]) => connected(c1, c2, s1, s2, tolerance));
      if (hits) {
        matched.add(id);
        covered.push([s1, s2]);
        changed = true;
      }
    }
  }
  return matched;
}

export type TileResizeOptions = { tolerance?: number; minSize?: number; minSeedOverlap?: number };
export type TileNeighborResult = { resizedRect: TileRect; updates: Map<string, TileRect> };

/**
 * Given every note's rect and how one note's rect just changed, returns the (possibly clamped) rect for
 * the resized note plus the position/size updates for whichever other notes share a boundary with it —
 * so resizing one edge of a tiled/grid layout keeps the whole seam (and everything transitively touching
 * it) flush, on all sides, not just the immediate pixel-adjacent neighbor.
 *
 * A shrinking neighbor's FAR edge (the one away from the resize) is always held fixed — that's what
 * guarantees it can never overlap whatever comes after it. The only way that guarantee could break is if
 * the neighbor is asked to shrink below `minSize`; rather than let that happen (which is what caused
 * neighbors to overlap the next note in a chain), the requested delta itself is clamped to whatever the
 * tightest neighbor in the chain can actually absorb — so the resize simply refuses to grow the primary
 * note past the point the chain can support, the same way a real resizable table stops a column drag at
 * its neighbors' minimum widths.
 */
export function computeTileNeighborAdjustments(
  rects: Map<string, TileRect>,
  resizedId: string,
  oldRect: TileRect,
  newRect: TileRect,
  opts: TileResizeOptions = {}
): TileNeighborResult {
  const tolerance = opts.tolerance ?? EDGE_TOLERANCE_DEFAULT;
  const minSize = opts.minSize ?? MIN_SIZE_DEFAULT;
  const minSeedOverlap = opts.minSeedOverlap ?? MIN_SEED_OVERLAP_DEFAULT;

  const updates = new Map<string, TileRect>();
  const getRect = (id: string): TileRect => updates.get(id) ?? rects.get(id)!;

  let dLeft = newRect.x - oldRect.x;
  let dRight = newRect.x + newRect.w - (oldRect.x + oldRect.w);
  let dTop = newRect.y - oldRect.y;
  let dBottom = newRect.y + newRect.h - (oldRect.y + oldRect.h);

  const vSpan: [number, number] = [oldRect.y, oldRect.y + oldRect.h];
  const hSpan: [number, number] = [oldRect.x, oldRect.x + oldRect.w];

  // Clamps `delta` (growth into the matched neighbors) to whatever the tightest one can shrink by
  // without going below minSize — every matched neighbor absorbs the SAME delta (they all shift/shrink
  // together to keep the seam flush), so the whole cascade is only as good as its tightest link.
  function clampGrowth(delta: number, ids: Set<string>, sizeOf: (r: TileRect) => number): number {
    if (delta <= 0) return delta;
    let maxDelta = delta;
    for (const id of ids) {
      const slack = Math.max(0, sizeOf(getRect(id)) - minSize);
      maxDelta = Math.min(maxDelta, slack);
    }
    return maxDelta;
  }

  if (Math.abs(dRight) > 0.5) {
    const ids = collectSeamNeighbors(rects, resizedId, oldRect.x + oldRect.w, (r) => r.x, (r) => [r.y, r.y + r.h], vSpan, tolerance, minSeedOverlap);
    dRight = clampGrowth(dRight, ids, (r) => r.w);
    for (const id of ids) {
      const r = getRect(id);
      updates.set(id, { x: r.x + dRight, y: r.y, w: r.w - dRight, h: r.h });
    }
  }
  if (Math.abs(dLeft) > 0.5) {
    const ids = collectSeamNeighbors(rects, resizedId, oldRect.x, (r) => r.x + r.w, (r) => [r.y, r.y + r.h], vSpan, tolerance, minSeedOverlap);
    dLeft = -clampGrowth(-dLeft, ids, (r) => r.w);
    for (const id of ids) {
      const r = getRect(id);
      updates.set(id, { ...r, w: r.w + dLeft });
    }
  }
  if (Math.abs(dBottom) > 0.5) {
    const ids = collectSeamNeighbors(rects, resizedId, oldRect.y + oldRect.h, (r) => r.y, (r) => [r.x, r.x + r.w], hSpan, tolerance, minSeedOverlap);
    dBottom = clampGrowth(dBottom, ids, (r) => r.h);
    for (const id of ids) {
      const r = getRect(id);
      updates.set(id, { x: r.x, y: r.y + dBottom, w: r.w, h: r.h - dBottom });
    }
  }
  if (Math.abs(dTop) > 0.5) {
    const ids = collectSeamNeighbors(rects, resizedId, oldRect.y, (r) => r.y + r.h, (r) => [r.x, r.x + r.w], hSpan, tolerance, minSeedOverlap);
    dTop = -clampGrowth(-dTop, ids, (r) => r.h);
    for (const id of ids) {
      const r = getRect(id);
      updates.set(id, { ...r, h: r.h + dTop });
    }
  }

  // The resized note itself only grows as far as the clamped deltas allow (shrinking is always fine,
  // since that only ever gives neighbors more room, never less).
  const resizedRect: TileRect = {
    x: oldRect.x + dLeft,
    y: oldRect.y + dTop,
    w: oldRect.w - dLeft + dRight,
    h: oldRect.h - dTop + dBottom,
  };

  // Belt-and-suspenders: verify nothing overlaps after clamping. This should be a no-op given the
  // clamping above, but if some future edge case slips through, drop the offending update rather than
  // ship a corrupted layout.
  const finalRects = new Map(rects);
  finalRects.set(resizedId, resizedRect);
  for (const [id, r] of updates) finalRects.set(id, r);

  function rectsOverlap(a: TileRect, b: TileRect): boolean {
    return a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
  }

  for (const id of Array.from(updates.keys())) {
    const updated = finalRects.get(id)!;
    let bad = false;
    for (const [otherId, otherRect] of finalRects) {
      if (otherId === id) continue;
      if (rectsOverlap(updated, otherRect)) {
        bad = true;
        break;
      }
    }
    if (bad) {
      updates.delete(id);
      finalRects.set(id, rects.get(id)!);
    }
  }

  return { resizedRect, updates };
}
