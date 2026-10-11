// Isometric projection and depth sorting for the landing-page city.
// Grid space: x runs east (down-right on screen), y runs south (down-left),
// z is height in screen pixels. Everything stands on the slab at z = GROUND.

export const TILE_W = 32;
export const TILE_H = 16;
export const GRID = 24;
export const VIEW_W = 880;
export const VIEW_H = 620;
export const ORIGIN_X = VIEW_W / 2;
export const ORIGIN_Y = 226;
export const GROUND = 8;

export type Pt = readonly [number, number];

export function project(x: number, y: number, z = 0): Pt {
  return [ORIGIN_X + (x - y) * (TILE_W / 2), ORIGIN_Y + (x + y) * (TILE_H / 2) - z];
}

/** Percent position inside the SVG box, for HTML overlays anchored to the scene. */
export function percent(x: number, y: number, z = 0): { left: string; top: string } {
  const [px, py] = project(x, y, z);
  return { left: `${((px / VIEW_W) * 100).toFixed(2)}%`, top: `${((py / VIEW_H) * 100).toFixed(2)}%` };
}

const f = (n: number) => Math.round(n * 10) / 10;

export function points(list: readonly Pt[]): string {
  return list.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export interface BoxSpec {
  x: number;
  y: number;
  w: number;
  d: number;
  z: number;
  h: number;
}

export interface Faces {
  top: string;
  left: string;
  right: string;
}

/** The three visible faces of a box. `inset` shrinks the top for a tapered tower. */
export function boxFaces({ x, y, w, d, z, h }: BoxSpec, inset = 0): Faces {
  const t = z + h;
  const A = project(x + inset, y + inset, t);
  const B = project(x + w - inset, y + inset, t);
  const C = project(x + w - inset, y + d - inset, t);
  const D = project(x + inset, y + d - inset, t);
  const Bb = project(x + w, y, z);
  const Cb = project(x + w, y + d, z);
  const Db = project(x, y + d, z);
  return { top: points([A, B, C, D]), left: points([D, C, Cb, Db]), right: points([C, B, Bb, Cb]) };
}

export interface Cylinder {
  body: string;
  top: { cx: number; cy: number; rx: number; ry: number };
  rx: number;
  ry: number;
}

/** A vertical cylinder of radius `r` tiles: an ellipse on top and a curved body. */
export function cylinder(cx: number, cy: number, r: number, z: number, h: number): Cylinder {
  const rx = r * Math.SQRT2 * (TILE_W / 2);
  const ry = r * Math.SQRT2 * (TILE_H / 2);
  const [tx, ty] = project(cx, cy, z + h);
  const [bx, by] = project(cx, cy, z);
  const body = `M ${f(tx - rx)} ${f(ty)} L ${f(bx - rx)} ${f(by)} A ${f(rx)} ${f(ry)} 0 0 0 ${f(bx + rx)} ${f(by)} L ${f(tx + rx)} ${f(ty)} A ${f(rx)} ${f(ry)} 0 0 1 ${f(tx - rx)} ${f(ty)} Z`;
  return { body, top: { cx: tx, cy: ty, rx, ry }, rx, ry };
}

// ---------------------------------------------------------------------------
// Depth sorting (painter's algorithm with a topological pass)
// ---------------------------------------------------------------------------

export interface Volume {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface ScreenBox {
  l: number;
  t: number;
  r: number;
  b: number;
}

export function screenBox(v: Volume): ScreenBox {
  return {
    l: project(v.x0, v.y1)[0],
    r: project(v.x1, v.y0)[0],
    t: project(v.x0, v.y0, v.z1)[1],
    b: project(v.x1, v.y1, v.z0)[1],
  };
}

export function overlaps(a: ScreenBox, b: ScreenBox, pad = 0.5): boolean {
  return a.l < b.r + pad && b.l < a.r + pad && a.t < b.b + pad && b.t < a.b + pad;
}

const EPS = 0.02;

/** True when `a` sits entirely behind `b` along some axis, so `a` must be drawn first. */
export function isBehind(a: Volume, b: Volume): boolean {
  return a.x1 <= b.x0 + EPS || a.y1 <= b.y0 + EPS || a.z1 <= b.z0 + EPS;
}

export function depthKey(v: Volume): number {
  return v.x0 + v.y0;
}

/**
 * Orders scene props back-to-front. Pairs that overlap on screen get an edge
 * from the one behind to the one in front; the rest fall back to x+y order.
 */
export function sortByDepth<T extends { vol: Volume }>(items: readonly T[]): T[] {
  const n = items.length;
  const boxes = items.map((i) => screenBox(i.vol));
  const keys = items.map((i) => depthKey(i.vol));
  const after: number[][] = Array.from({ length: n }, () => []);
  const indeg = new Array<number>(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!overlaps(boxes[i], boxes[j])) continue;
      const ij = isBehind(items[i].vol, items[j].vol);
      const ji = isBehind(items[j].vol, items[i].vol);
      if (ij === ji) continue;
      const [first, second] = ij ? [i, j] : [j, i];
      after[first].push(second);
      indeg[second]++;
    }
  }

  const out: T[] = [];
  const done = new Array<boolean>(n).fill(false);
  const ready = new Set<number>();
  for (let i = 0; i < n; i++) if (indeg[i] === 0) ready.add(i);

  while (out.length < n) {
    let pick = -1;
    const pool = ready.size ? ready : new Set(items.map((_, i) => i).filter((i) => !done[i]));
    for (const i of pool) if (pick < 0 || keys[i] < keys[pick]) pick = i;
    ready.delete(pick);
    done[pick] = true;
    out.push(items[pick]);
    for (const j of after[pick]) if (!done[j] && --indeg[j] <= 0) ready.add(j);
  }
  return out;
}

/** Where a moving thing belongs among sorted static props: right after the last prop behind it that it overlaps. */
export function insertionIndex(vol: Volume, statics: readonly { vol: Volume; box: ScreenBox }[]): number {
  const box = screenBox(vol);
  let idx = 0;
  let fallback = 0;
  const key = depthKey(vol);
  for (let i = 0; i < statics.length; i++) {
    const s = statics[i];
    if (depthKey(s.vol) <= key) fallback = i + 1;
    if (overlaps(s.box, box) && isBehind(s.vol, vol) && !isBehind(vol, s.vol)) idx = i + 1;
  }
  return idx > 0 ? idx : fallback;
}
