export type Point = { x: number; y: number };

/**
 * Builds a smoothed SVG path through a sequence of points using quadratic Bezier curves
 * through each pair's midpoint — the standard trick for freehand pen lines that avoids the
 * jagged look of a raw polyline while staying cheap enough to redraw on every pointer move.
 */
export function buildSmoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Drops points closer than `minDistance` to the last kept point — keeps the array lean without visibly changing the line. */
export function appendSmoothed(points: Point[], next: Point, minDistance = 2): Point[] {
  const last = points[points.length - 1];
  if (last && distance(last, next) < minDistance) return points;
  return [...points, next];
}

export function boundingBox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
