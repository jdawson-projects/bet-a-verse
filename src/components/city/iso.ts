// Isometric projection for the campus map.
// Grid space: x runs east (down-right on screen), y runs south (down-left),
// z is height in scene units. Everything stands on the slab at z = GROUND.
// Scene units are the 880×620 "viewBox"; the renderer maps them to pixels.

export const TILE_W = 40;
export const TILE_H = 20;
export const GRID = 22;
export const VIEW_W = 880;
export const VIEW_H = 660;
export const ORIGIN_X = VIEW_W / 2;
export const ORIGIN_Y = 212;
export const GROUND = 8;

export type Pt = readonly [number, number];
export type P3 = readonly [number, number, number];

export function project(x: number, y: number, z = 0): Pt {
  return [ORIGIN_X + (x - y) * (TILE_W / 2), ORIGIN_Y + (x + y) * (TILE_H / 2) - z];
}

/**
 * How close a point is to the camera. Points along the view ray (1, 1, TILE_H)
 * share a screen position, so this is what the depth buffer compares.
 */
export function nearness(x: number, y: number, z: number): number {
  return x + y + z / TILE_H;
}

/** Percent position inside the scene box, for HTML overlays anchored to the map. */
export function percent(x: number, y: number, z = 0): { left: string; top: string } {
  const [px, py] = project(x, y, z);
  return { left: `${((px / VIEW_W) * 100).toFixed(2)}%`, top: `${((py / VIEW_H) * 100).toFixed(2)}%` };
}

export interface BoxSpec {
  x: number;
  y: number;
  w: number;
  d: number;
  z: number;
  h: number;
}
