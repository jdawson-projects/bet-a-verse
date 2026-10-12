// The University of Chicago campus, Hyde Park, as pixel-art geometry.
// Grid: x east (Ellis → the Metra tracks), y south (55th → 60th Street).
// Streets: rows y = 1 (55th), 5 (56th), 9 (57th), 13 (58th), 17 (59th), 21 (60th);
// columns x = 3 (Ellis), 9 (University), 14 (Woodlawn), 18 (Dorchester).
// Nothing is to scale; it's a map a student would recognize.

import { GROUND, project, VIEW_H, VIEW_W, type BoxSpec, type P3, type Pt } from "./iso";
import { Mesh } from "./mesh";
import { hex, mix, type Palette, type RGB, type Shades } from "./palette";

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const LIMESTONE = hex("#d9d2bf");
const LIMESTONE_DARK = hex("#c9c0a8");
const TILE_ROOF = hex("#c9552c");
const SLATE = hex("#596273");
const BRICK = hex("#a4523d");
const GREYSTONE = hex("#b8b2a4");
const GLASS = hex("#8fb8dc");
const WHITE = hex("#eef0eb");
const CONCRETE = hex("#d0cabb");

type Skin = "none" | "grid" | "gothic" | "slits";

/** A thing on the map. Ground props draw at scale 1; the rest grow in. */
export interface Prop {
  id: string;
  rises: boolean;
  draw: (m: Mesh, p: Palette) => void;
}

const SKY_BIAS = 300;

// ---------------------------------------------------------------------------
// Building parts
// ---------------------------------------------------------------------------

function frac(n: number) {
  return n - Math.floor(n);
}

/** Lit or dark at night, decided once per window so the pattern is stable. */
function windowColor(p: Palette, seed: number): { c: RGB; a: number } {
  if (!p.night) return { c: p.window, a: p.windowAlpha };
  return frac(Math.sin(seed * 12.9898) * 43758.5453) < 0.7 ? { c: p.windowLit, a: 1 } : { c: p.windowDark, a: 1 };
}

/** Windows on the two visible faces. `gothic` adds a pointed top; `slits` are floor-to-roof stripes. */
function windows(m: Mesh, b: BoxSpec, skin: Skin, p: Palette) {
  if (skin === "none") return;
  const colStep = skin === "slits" ? 0.16 : skin === "gothic" ? 0.26 : 0.22;
  const ww = skin === "slits" ? 0.05 : skin === "gothic" ? 0.09 : 0.1;
  const rowStep = skin === "gothic" ? 9 : 7;
  const wh = skin === "gothic" ? 5 : 3.2;
  const top = b.z + b.h;
  const bias = 0.02;

  const paint = (quad: P3[], seed: number) => {
    const { c, a } = windowColor(p, seed);
    m.poly(quad, c, skin === "slits" && !p.night ? 0.35 : a, bias);
    if (skin === "gothic") {
      const [q0, q1, q2, q3] = quad;
      m.tri(q3, q2, [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, q2[2] + 1.8], c, a, bias);
    }
  };

  // Left face: plane y = b.y + b.d, columns along x.
  const yL = b.y + b.d;
  for (let x = b.x + 0.09; x + ww <= b.x + b.w - 0.07; x += colStep) {
    if (skin === "slits") {
      paint([[x, yL, b.z + 2], [x + ww, yL, b.z + 2], [x + ww, yL, top - 2], [x, yL, top - 2]], x * 7 + b.y);
      continue;
    }
    for (let z = b.z + 3; z + wh <= top - 2.5; z += rowStep) {
      paint([[x, yL, z], [x + ww, yL, z], [x + ww, yL, z + wh], [x, yL, z + wh]], x * 7 + z * 13 + b.y);
    }
  }
  // Right face: plane x = b.x + b.w, columns along y.
  const xR = b.x + b.w;
  for (let y = b.y + 0.09; y + ww <= b.y + b.d - 0.07; y += colStep) {
    if (skin === "slits") {
      paint([[xR, y + ww, b.z + 2], [xR, y, b.z + 2], [xR, y, top - 2], [xR, y + ww, top - 2]], y * 11 + b.x);
      continue;
    }
    for (let z = b.z + 3; z + wh <= top - 2.5; z += rowStep) {
      paint([[xR, y + ww, z], [xR, y, z], [xR, y, z + wh], [xR, y + ww, z + wh]], y * 11 + z * 17 + b.x);
    }
  }
}

/** Stone ribs against the two visible walls. */
function buttresses(m: Mesh, b: BoxSpec, s: Shades) {
  const h = b.h * 0.7;
  for (let x = b.x + 0.22; x + 0.12 < b.x + b.w - 0.15; x += 0.5) {
    m.box({ x, y: b.y + b.d, w: 0.12, d: 0.1, z: b.z, h }, s);
  }
  for (let y = b.y + 0.22; y + 0.12 < b.y + b.d - 0.15; y += 0.5) {
    m.box({ x: b.x + b.w, y, w: 0.1, d: 0.12, z: b.z, h }, s);
  }
}

/** Crenellated parapet along every top edge. */
function merlons(m: Mesh, b: BoxSpec, s: Shades) {
  const t = b.z + b.h;
  const sz = 0.09;
  for (let x = b.x; x + sz <= b.x + b.w + 0.001; x += 0.2) {
    m.box({ x, y: b.y + b.d - sz, w: sz, d: sz, z: t, h: 3 }, s, { outline: false });
    m.box({ x, y: b.y, w: sz, d: sz, z: t, h: 3 }, s, { outline: false });
  }
  for (let y = b.y; y + sz <= b.y + b.d + 0.001; y += 0.2) {
    m.box({ x: b.x + b.w - sz, y, w: sz, d: sz, z: t, h: 3 }, s, { outline: false });
    m.box({ x: b.x, y, w: sz, d: sz, z: t, h: 3 }, s, { outline: false });
  }
}

function pinnacles(m: Mesh, b: BoxSpec, s: Shades, h = 14) {
  const t = b.z + b.h;
  const sz = Math.min(b.w, b.d) * 0.22;
  for (const [x, y] of [
    [b.x, b.y],
    [b.x + b.w - sz, b.y],
    [b.x, b.y + b.d - sz],
    [b.x + b.w - sz, b.y + b.d - sz],
  ] as const) {
    m.box({ x, y, w: sz, d: sz, z: t, h }, s, { inset: sz * 0.32 });
  }
}

/** A pointed-arch doorway on the front-left face. */
function door(m: Mesh, b: BoxSpec, s: Shades) {
  const y = b.y + b.d;
  const cx = b.x + b.w / 2;
  const w = 0.16;
  const h = 7;
  const c = s.edge;
  m.poly([[cx - w / 2, y, b.z], [cx + w / 2, y, b.z], [cx + w / 2, y, b.z + h], [cx - w / 2, y, b.z + h]], c, 1, 0.03);
  m.tri([cx - w / 2, y, b.z + h], [cx + w / 2, y, b.z + h], [cx, y, b.z + h + 2.5], c, 1, 0.03);
}

function tree(m: Mesh, p: Palette, x: number, y: number, r = 5) {
  const base: P3 = [x, y, GROUND];
  const topZ = GROUND + 5;
  m.line(base, [x, y, topZ], 1, p.trunk);
  const [sx, sy] = project(x, y, topZ + r * 0.9);
  const near = x + y + (topZ + r) / 16;
  const circle = (cx: number, cy: number, rr: number, n: number, c: RGB, nearBias: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      pts.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t) * 0.9]);
    }
    m.polyScreen(pts, near + nearBias, c);
  };
  circle(sx, sy, r + m.px * 0.9, 10, p.leafEdge, -0.005);
  circle(sx, sy, r, 10, p.leaf, 0);
  circle(sx - r * 0.3, sy - r * 0.32, r * 0.55, 8, p.leafLight, 0.005);
}

// ---------------------------------------------------------------------------
// Prop constructors
// ---------------------------------------------------------------------------

const props: Prop[] = [];
const add = (id: string, rises: boolean, draw: Prop["draw"]) => props.push({ id, rises, draw });

function building(id: string, b: Omit<BoxSpec, "z">, base: RGB, skin: Skin = "grid") {
  add(id, true, (m, p) => {
    const spec = { ...b, z: GROUND };
    m.box(spec, p.shades(base));
    windows(m, spec, skin, p);
  });
}

/** Gothic hall: limestone, lancet windows, buttresses, an arched door, a clay-tile roof. */
function gothic(
  id: string,
  b: Omit<BoxSpec, "z">,
  axis: "x" | "y",
  rise = 14,
  opts: { color?: RGB; roof?: RGB; buttress?: boolean; door?: boolean } = {},
) {
  const { color = LIMESTONE, roof = TILE_ROOF, buttress = true, door: hasDoor = true } = opts;
  add(id, true, (m, p) => {
    const spec = { ...b, z: GROUND };
    const s = p.shades(color);
    m.box(spec, s);
    windows(m, spec, "gothic", p);
    if (buttress) buttresses(m, spec, s);
    if (hasDoor) door(m, spec, s);
    m.gable(spec, rise, axis, p.roofShades(roof));
  });
}

function tower(id: string, b: Omit<BoxSpec, "z">, color = LIMESTONE, pinnacleH = 14, crenellated = true) {
  add(id, true, (m, p) => {
    const spec = { ...b, z: GROUND };
    const s = p.shades(color);
    m.box(spec, s);
    windows(m, spec, "gothic", p);
    if (crenellated) merlons(m, spec, s);
    if (pinnacleH > 0) pinnacles(m, spec, s, pinnacleH);
  });
}

function trees(id: string, list: readonly (readonly [number, number, number?])[]) {
  add(id, true, (m, p) => {
    for (const [x, y, r] of list) tree(m, p, x, y, r);
  });
}

function treeLine(id: string, from: Pt, to: Pt, step: number, r = 5) {
  const list: [number, number, number][] = [];
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.floor(len / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    list.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, r + ((i * 7) % 3) - 1]);
  }
  trees(id, list);
}

// ---------------------------------------------------------------------------
// Ground (drawn first, never rises)
// ---------------------------------------------------------------------------

const STREET_ROWS = [1, 5, 9, 13, 17, 21];
const STREET_COLS = [3, 9, 14, 18];
const EAST_EDGE = 21.6;

const flat = (x0: number, y0: number, x1: number, y1: number, z: number): P3[] => [
  [x0, y0, z],
  [x1, y0, z],
  [x1, y1, z],
  [x0, y1, z],
];

add("ground", false, (m, p) => {
  // The slab and its edges
  const slab = p.shades(p.land);
  m.box({ x: 0, y: 0, w: 24, d: 24, z: 0, h: GROUND }, { top: p.land, left: p.landEdge, right: mix(p.landEdge, hex("#000000"), 0.2), edge: slab.edge });

  // Lawns and parks
  const park = (x0: number, y0: number, x1: number, y1: number, a = 1) => m.poly(flat(x0, y0, x1, y1, GROUND + 0.03), p.park, a);
  park(4, 10, 9, 17);
  park(0, 18, EAST_EDGE, 21);
  park(10, 10, 14, 13, 0.8);
  park(10, 14, 14, 17, 0.8);
  park(15, 11.6, 18, 13, 0.7);
  park(22.8, 0, 24, 24);
  park(0, 2, 3, 5);

  // Quad paths
  m.poly(flat(6.4, 10.2, 6.7, 16.8, GROUND + 0.06), p.path);
  m.poly(flat(4.2, 13.2, 8.8, 13.45, GROUND + 0.06), p.path);

  // Streets with center dashes
  for (const y of STREET_ROWS) m.poly(flat(0, y, EAST_EDGE, y + 1, GROUND + 0.05), p.street);
  for (const x of STREET_COLS) m.poly(flat(x, 0, x + 1, 24, GROUND + 0.05), p.street);
  for (const y of STREET_ROWS) {
    for (let x = 0.4; x < EAST_EDGE - 0.5; x += 0.8) m.line([x, y + 0.5, GROUND + 0.08], [x + 0.32, y + 0.5, GROUND + 0.08], 1, p.dash);
  }
  for (const x of STREET_COLS) {
    for (let y = 0.4; y < 23.6; y += 0.8) m.line([x + 0.5, y, GROUND + 0.08], [x + 0.5, y + 0.32, GROUND + 0.08], 1, p.dash);
  }

  // Stagg Field: track oval, bleachers, goalposts
  m.ellipse(1.7, 3.5, 1.08, 1.12, GROUND + 0.07, p.track);
  m.ellipse(1.7, 3.5, 0.84, 0.88, GROUND + 0.09, p.park);
  m.ellipse(1.7, 3.5, 0.8, 0.84, GROUND + 0.1, p.fieldLine, 0.9);
  m.ellipse(1.7, 3.5, 0.74, 0.78, GROUND + 0.11, p.park);
  m.box({ x: 0.25, y: 2.5, w: 0.3, d: 2, z: GROUND, h: 10 }, p.shades(hex("#8d94a3")));
  for (const gx of [1.0, 2.45]) {
    m.line([gx, 3.5, GROUND], [gx, 3.5, GROUND + 9], 1, p.fieldLine);
    m.line([gx - 0.18, 3.5, GROUND + 9], [gx + 0.18, 3.5, GROUND + 9], 1, p.fieldLine);
  }

  // Botany Pond, the Law School pool and fountain, the Midway rink
  m.ellipse(7.3, 11.7, 0.5, 0.4, GROUND + 0.07, p.waterRim);
  m.ellipse(7.3, 11.7, 0.42, 0.32, GROUND + 0.09, p.water);
  m.ellipse(12.0, 22.45, 1.38, 0.34, GROUND + 0.07, p.waterRim);
  m.ellipse(12.0, 22.45, 1.24, 0.25, GROUND + 0.09, p.water);
  m.dot([12.0, 22.45, GROUND + 5], 2, p.fountain);
  m.dot([11.9, 22.45, GROUND + 3], 1, p.fountain);
  m.dot([12.1, 22.45, GROUND + 3], 1, p.fountain);
  m.ellipse(13.5, 19.5, 1.25, 0.58, GROUND + 0.07, mix(p.rink, p.land, 0.4));
  m.ellipse(13.5, 19.5, 1.1, 0.48, GROUND + 0.09, p.rink);

  // The Metra embankment with two tracks and the 59th Street shelter
  const bermTop = GROUND + 14;
  m.box({ x: 21.6, y: 0, w: 1.2, d: 24, z: GROUND, h: 14 }, p.shades(p.berm));
  for (let y = 0.3; y < 24; y += 0.5) m.line([21.8, y, bermTop + 0.1], [22.6, y, bermTop + 0.1], 1, p.tie, 0.8, 0.02);
  for (const x of [21.95, 22.45]) m.line([x, 0, bermTop + 0.2], [x, 24, bermTop + 0.2], 1, p.rail, 1, 0.03);
  m.box({ x: 21.75, y: 16.6, w: 0.35, d: 1.1, z: bermTop, h: 9 }, p.shades(hex("#7f1d1d")));
});

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

// West of Ellis
building("eckhardt", { x: 0.3, y: 6.3, w: 2.4, d: 2.3, h: 52 }, GLASS, "grid");
building("crerar", { x: 0.3, y: 10.3, w: 2.3, d: 2.4, h: 46 }, CONCRETE, "slits");
gothic("labs", { x: 0.3, y: 14.3, w: 2.4, d: 2.3, h: 38 }, "x", 10, { color: LIMESTONE_DARK, roof: SLATE, buttress: false });
building("logan-tower", { x: 0.4, y: 22.3, w: 1.3, d: 1.4, h: 136 }, CONCRETE, "slits");
building("logan-wing", { x: 1.8, y: 22.3, w: 1.0, d: 1.4, h: 26 }, CONCRETE, "grid");

// Ratner: a low hall with masts and cables over the roof
add("ratner", true, (m, p) => {
  const b: BoxSpec = { x: 4.3, y: 2.4, w: 4.2, d: 2.2, z: GROUND, h: 30 };
  m.box(b, p.shades(hex("#e0e4e5")));
  windows(m, b, "slits", p);
  const cable = mix(p.shades(WHITE).right, p.land, 0.3);
  for (const x of [5.2, 6.4, 7.6]) {
    const top: P3 = [x, 3.5, GROUND + 92];
    m.line([x - 0.9, 2.4, GROUND + 30], top, 1, cable, 0.9);
    m.line([x + 0.9, 4.6, GROUND + 30], top, 1, cable, 0.9);
    m.line([x, 3.5, GROUND + 30], top, 2, p.shades(WHITE).top);
  }
});

// Max P: three colored blocks
for (const [i, c] of ["#d9661f", "#b6433b", "#6e4a8e"].entries()) {
  building(`maxp-${i}`, { x: 4.2 + i * 1.55, y: 6.1, w: 1.35, d: 1.0, h: 44 }, hex(c), "grid");
}
building("reg", { x: 4.2, y: 7.4, w: 3.2, d: 1.5, h: 60 }, hex("#d8d1bf"), "slits");

// Mansueto: a glass dome beside the Reg
add("mansueto", true, (m, p) => {
  const cx = 8.15;
  const cy = 8.15;
  const r = 0.66;
  const rings = 7;
  const glass = p.shades(p.glass);
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const rr = r * Math.sqrt(1 - t * t);
    const z = GROUND + 26 * t;
    m.ellipse(cx, cy, rr, rr, z, mix(glass.left, glass.top, t), 1, 0.01 * i, 16);
  }
  m.ellipse(cx, cy, r + 0.08, r + 0.08, GROUND + 0.04, p.waterRim, 1, 0, 16);
});

// The main quad
gothic("snell-hitchcock", { x: 4.2, y: 10.2, w: 1.5, d: 0.7, h: 40 }, "x", 12);
gothic("hull", { x: 6.0, y: 10.2, w: 1.0, d: 0.7, h: 36 }, "x", 11);
gothic("reynolds", { x: 7.4, y: 10.2, w: 1.4, d: 0.8, h: 44 }, "x", 14);
tower("mitchell", { x: 8.1, y: 10.2, w: 0.7, d: 0.7, h: 118 }, LIMESTONE, 12);
gothic("cobb", { x: 4.2, y: 11.2, w: 0.7, d: 2.2, h: 46 }, "y", 13);
gothic("ryerson", { x: 4.2, y: 13.7, w: 0.7, d: 1.5, h: 42 }, "y", 12);
gothic("swift", { x: 8.1, y: 11.4, w: 0.7, d: 1.4, h: 44 }, "y", 13);
gothic("classics", { x: 8.1, y: 13.1, w: 0.7, d: 2.0, h: 40 }, "y", 12);
gothic("harper", { x: 5.4, y: 15.6, w: 2.2, d: 1.2, h: 52 }, "x", 16);
tower("harper-w", { x: 4.4, y: 15.6, w: 1.0, d: 1.2, h: 108 });
tower("harper-e", { x: 7.6, y: 15.6, w: 1.0, d: 1.2, h: 108 });

// South of the Midway, west side
gothic("burton-judson", { x: 4.3, y: 22.3, w: 4.4, d: 1.4, h: 44 }, "x", 14, { color: LIMESTONE_DARK, roof: SLATE });
tower("bj-tower", { x: 6.2, y: 22.3, w: 0.7, d: 0.7, h: 78 }, LIMESTONE_DARK, 10);

// University → Woodlawn
add("campus-north", true, (m, p) => {
  const s = p.shades(WHITE);
  for (const b of [
    { x: 10.3, y: 2.3, w: 3.4, d: 2.4, z: GROUND, h: 22 },
    { x: 10.4, y: 2.4, w: 1.2, d: 2.2, z: GROUND + 22, h: 108 },
    { x: 12.4, y: 2.4, w: 1.2, d: 1.1, z: GROUND + 22, h: 76 },
  ]) {
    m.box(b, s);
    windows(m, b, "grid", p);
  }
});
building("crown-fieldhouse", { x: 10.3, y: 6.2, w: 3.4, d: 1.0, h: 34 }, LIMESTONE_DARK, "gothic");
gothic("bartlett", { x: 10.3, y: 7.6, w: 2.2, d: 1.2, h: 46 }, "x", 14);
gothic("saieh-main", { x: 11.4, y: 10.3, w: 2.1, d: 0.9, h: 42 }, "x", 13);
gothic("saieh-wing", { x: 10.3, y: 10.3, w: 0.9, d: 1.3, h: 42 }, "y", 13, { door: false });
tower("saieh-tower", { x: 10.3, y: 11.7, w: 1.0, d: 1.0, h: 122 }, LIMESTONE_DARK, 12);
gothic("oriental-institute", { x: 11.9, y: 11.8, w: 1.8, d: 1.0, h: 40 }, "x", 12, { color: LIMESTONE_DARK, roof: SLATE });
gothic("rockefeller-nave", { x: 10.5, y: 15.3, w: 2.1, d: 1.3, h: 58 }, "x", 20, { roof: SLATE });
tower("rockefeller-tower", { x: 12.6, y: 15.1, w: 1.2, d: 1.5, h: 188 }, LIMESTONE, 18);

// The Law School: fluted glass
building("law", { x: 10.6, y: 22.9, w: 2.8, d: 1.0, h: 64 }, hex("#9fc2dd"), "slits");

// Woodlawn → Dorchester
building("apt-d1", { x: 15.2, y: 2.3, w: 1.1, d: 2.4, h: 36 }, GREYSTONE, "grid");
building("apt-d2", { x: 16.6, y: 2.3, w: 1.1, d: 2.4, h: 42 }, BRICK, "grid");
building("apt-d3", { x: 15.2, y: 6.3, w: 2.5, d: 1.0, h: 40 }, GREYSTONE, "grid");
building("apt-d4", { x: 15.2, y: 7.7, w: 1.0, d: 1.1, h: 32 }, BRICK, "grid");
building("apt-d5", { x: 15.2, y: 10.3, w: 2.4, d: 1.0, h: 34 }, GREYSTONE, "grid");

// Robie House: long brick, deep flat roofs
add("robie", true, (m, p) => {
  const brick = p.shades(BRICK);
  const roof = p.shades(hex("#6f5040"));
  const base: BoxSpec = { x: 15.3, y: 12.0, w: 2.0, d: 0.75, z: GROUND, h: 12 };
  const upper: BoxSpec = { x: 15.9, y: 12.1, w: 1.1, d: 0.55, z: GROUND + 15, h: 10 };
  const slab = (b: BoxSpec, over: number, z: number) =>
    m.box({ x: b.x - over, y: b.y - over * 0.6, w: b.w + over * 2, d: b.d + over * 1.2, z, h: 2.5 }, roof);
  m.box(base, brick);
  windows(m, base, "slits", p);
  slab(base, 0.3, GROUND + 12);
  m.box(upper, brick);
  windows(m, upper, "slits", p);
  slab(upper, 0.35, GROUND + 25);
});

// Booth: a glass box under a white roof slab on posts
add("booth", true, (m, p) => {
  const b: BoxSpec = { x: 15.2, y: 14.2, w: 2.6, d: 1.4, z: GROUND, h: 44 };
  m.box(b, p.shades(GLASS));
  windows(m, b, "grid", p);
  const top = GROUND + 44;
  const post = p.shades(hex("#c9d1d8")).left;
  for (const [x, y] of [
    [15.15, 15.7],
    [17.85, 15.7],
    [17.85, 14.1],
  ] as const) {
    m.line([x, y, top], [x, y, top + 5], 1, post);
  }
  m.box({ x: 15.0, y: 14.0, w: 3.0, d: 1.8, z: top + 5, h: 3 }, p.shades(hex("#f4f5f2")));
});

gothic("ida-noyes", { x: 15.2, y: 15.9, w: 2.3, d: 0.9, h: 34 }, "x", 12, { color: hex("#a35b45"), buttress: false });
tower("ida-noyes-tower", { x: 17.0, y: 15.9, w: 0.6, d: 0.6, h: 56 }, hex("#a35b45"), 8);
building("keller", { x: 15.3, y: 22.3, w: 2.4, d: 1.4, h: 40 }, hex("#d8d2c0"), "grid");

// Dorchester → the tracks
building("apt-e1", { x: 19.2, y: 2.3, w: 1.0, d: 2.4, h: 34 }, BRICK, "grid");
building("apt-e2", { x: 20.4, y: 2.3, w: 1.0, d: 2.4, h: 30 }, GREYSTONE, "grid");
building("apt-e3", { x: 19.2, y: 6.3, w: 2.2, d: 1.0, h: 44 }, GREYSTONE, "grid");
building("apt-e4", { x: 19.2, y: 7.7, w: 1.0, d: 1.1, h: 36 }, BRICK, "grid");
building("apt-e5", { x: 19.2, y: 10.3, w: 1.0, d: 2.4, h: 48 }, hex("#b89b7a"), "grid");
building("apt-e6", { x: 20.4, y: 10.3, w: 1.0, d: 2.4, h: 40 }, GREYSTONE, "grid");
building("ihouse", { x: 19.2, y: 14.3, w: 2.2, d: 2.3, h: 64 }, hex("#cdbf9f"), "gothic");
tower("ihouse-tower", { x: 19.9, y: 14.3, w: 1.0, d: 1.0, h: 116 }, hex("#cdbf9f"), 10);
building("apt-e7", { x: 19.2, y: 22.3, w: 2.2, d: 1.4, h: 36 }, BRICK, "grid");

// Trees
trees("quad-trees", [
  [5.6, 12.0],
  [6.9, 12.9],
  [5.4, 14.6, 6],
  [7.5, 14.4],
  [6.3, 11.3, 4],
  [7.9, 12.9, 4],
]);
treeLine("midway-n", [0.6, 18.3], [21.0, 18.3], 1.5, 5);
treeLine("midway-s", [1.3, 20.7], [21.0, 20.7], 1.5, 5);
treeLine("57th-n", [11.0, 8.75], [13.6, 8.75], 1.3, 4);
treeLine("saieh-lawn", [11.9, 11.3], [13.4, 11.3], 0.75, 4);
treeLine("rock-lawn", [10.6, 14.4], [12.2, 14.4], 0.8, 4);
treeLine("park-e", [23.3, 0.6], [23.3, 23.4], 1.2, 5);
trees("misc-trees", [
  [2.0, 20.2, 4],
  [3.5, 23.6, 4],
  [13.8, 6.6, 4],
  [8.0, 7.0, 4],
  [18.5, 12.6, 4],
  [14.6, 12.8, 4],
  [16.8, 11.4, 4],
  [20.6, 21.0, 4],
  [1.5, 17.5, 4],
]);

export const PROPS: readonly Prop[] = props;

/** Everything that doesn't move. `riseAt(i)` is 0..1 per prop for the grow-in. */
export function buildStatic(m: Mesh, p: Palette, riseAt: (i: number) => number) {
  m.reset();
  // Soft drop shadow under the slab (an ellipse on the page, behind everything)
  const [sx, sy] = project(12, 12, 0);
  const pts: Pt[] = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    pts.push([sx + 356 * Math.cos(t), sy + 22 + 150 * Math.sin(t)]);
  }
  m.polyScreen(pts, -150, p.shadow, p.shadowAlpha);

  for (let i = 0; i < PROPS.length; i++) {
    const prop = PROPS[i];
    m.heightScale = prop.rises ? riseAt(i) : 1;
    prop.draw(m, p);
  }
  m.heightScale = 1;
}

// ---------------------------------------------------------------------------
// Sky: stars at night, drifting clouds
// ---------------------------------------------------------------------------

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

const STARS = (() => {
  const rand = seeded(7);
  return Array.from({ length: 40 }, (_, i) => ({ x: 20 + rand() * (VIEW_W - 40), y: 10 + rand() * 150, phase: i * 0.7, size: 1 + (i % 3 === 0 ? 1 : 0) }));
})();

const CLOUDS = [
  { x: 150, y: 118, k: 1, speed: 0.021, phase: 0 },
  { x: 690, y: 72, k: 0.8, speed: 0.014, phase: 2 },
  { x: 410, y: 44, k: 0.6, speed: 0.025, phase: 4 },
];

export function buildSky(m: Mesh, p: Palette, t: number) {
  m.reset();
  if (p.night) {
    for (const st of STARS) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.1 + st.phase));
      const h = (st.size * m.px) / 2;
      m.polyScreen(
        [
          [st.x - h, st.y - h],
          [st.x + h, st.y - h],
          [st.x + h, st.y + h],
          [st.x - h, st.y + h],
        ],
        -200,
        p.star,
        a,
      );
    }
  }
  for (const c of CLOUDS) {
    const dx = 42 * Math.sin(t * c.speed + c.phase);
    const blob = (cx: number, cy: number, rx: number, ry: number) => {
      const pts: Pt[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      m.polyScreen(pts, SKY_BIAS, p.cloud, p.cloudAlpha);
    };
    blob(c.x + dx, c.y, 34 * c.k, 11 * c.k);
    blob(c.x + dx - 14 * c.k, c.y - 5 * c.k, 16 * c.k, 10 * c.k);
    blob(c.x + dx + 12 * c.k, c.y - 7 * c.k, 20 * c.k, 12 * c.k);
  }
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export interface VehicleSpec {
  id: string;
  /** Closed loop in grid coordinates. */
  path: readonly Pt[];
  /** tiles per second */
  speed: number;
  /** starting distance along the path, in tiles */
  offset: number;
  z: number;
  len: number;
  wid: number;
  h: number;
  color: RGB;
  /** A window band around the body (buses, trains). */
  band?: RGB;
  /** A smaller cabin on top (cars). */
  cabin?: boolean;
}

const loop = (...pts: Pt[]): Pt[] => pts;

export const VEHICLES: readonly VehicleSpec[] = [
  { id: "bus55", path: loop([0.3, 1.3], [21.2, 1.3], [21.2, 1.7], [0.3, 1.7]), speed: 2.0, offset: 6, z: GROUND, len: 1.15, wid: 0.42, h: 11, color: hex("#f3f4f6"), band: hex("#2b5fd9") },
  { id: "ugo", path: loop([9.3, 5.3], [9.3, 21.7], [14.7, 21.7], [14.7, 5.3]), speed: 1.7, offset: 14, z: GROUND, len: 0.8, wid: 0.4, h: 9, color: hex("#7a1d2b"), band: hex("#2a2a30") },
  { id: "taxi", path: loop([0.3, 9.3], [21.2, 9.3], [21.2, 9.7], [0.3, 9.7]), speed: 2.5, offset: 30, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: hex("#f2c230"), cabin: true },
  { id: "car-ellis", path: loop([3.3, 0.3], [3.3, 23.7], [3.7, 23.7], [3.7, 0.3]), speed: 2.1, offset: 9, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: hex("#d7262b"), cabin: true },
  { id: "car-59th", path: loop([0.3, 17.3], [21.2, 17.3], [21.2, 17.7], [0.3, 17.7]), speed: 2.3, offset: 22, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: hex("#f5f6f8"), cabin: true },
  { id: "car-dorch", path: loop([18.3, 0.3], [18.3, 23.7], [18.7, 23.7], [18.7, 0.3]), speed: 1.9, offset: 33, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: hex("#1f3a8a"), cabin: true },
  { id: "car-60th", path: loop([0.3, 21.3], [21.2, 21.3], [21.2, 21.7], [0.3, 21.7]), speed: 2.2, offset: 2, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: hex("#2f7d4f"), cabin: true },
  ...[0, 1, 2].map((i) => ({
    id: `metra-${i}`,
    path: loop([21.95, 0.3], [21.95, 23.7], [22.45, 23.7], [22.45, 0.3]),
    speed: 3.2,
    offset: 5 + i * 1.5,
    z: GROUND + 14,
    len: 1.3,
    wid: 0.38,
    h: 12,
    color: hex("#ccd1d8"),
    band: hex("#e3692b"),
  })),
];

function pathLengths(path: readonly Pt[]): number[] {
  return path.map((a, i) => {
    const b = path[(i + 1) % path.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
}

const LENGTHS = new Map(VEHICLES.map((v) => [v.id, pathLengths(v.path)]));

/** Where a vehicle is after `t` seconds: an oriented box on its path. */
export function poseAt(v: VehicleSpec, t: number): BoxSpec {
  const lens = LENGTHS.get(v.id)!;
  const total = lens.reduce((a, b) => a + b, 0);
  let dist = (v.offset + v.speed * t) % total;
  if (dist < 0) dist += total;
  let i = 0;
  while (dist > lens[i]) {
    dist -= lens[i];
    i = (i + 1) % lens.length;
  }
  const a = v.path[i];
  const b = v.path[(i + 1) % v.path.length];
  const u = lens[i] === 0 ? 0 : dist / lens[i];
  const cx = a[0] + (b[0] - a[0]) * u;
  const cy = a[1] + (b[1] - a[1]) * u;
  const alongX = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
  const w = alongX ? v.len : v.wid;
  const d = alongX ? v.wid : v.len;
  return { x: cx - w / 2, y: cy - d / 2, w, d, z: v.z, h: v.h };
}

export function buildVehicles(m: Mesh, p: Palette, t: number) {
  m.reset();
  for (const v of VEHICLES) {
    const box = poseAt(v, t);
    m.box(box, p.shades(v.color));
    if (v.band) {
      const band = { ...box, z: box.z + v.h * 0.45, h: v.h * 0.35 };
      const s = p.shades(v.band);
      const bt = band.z + band.h;
      m.poly([[band.x, band.y + band.d, bt], [band.x + band.w, band.y + band.d, bt], [band.x + band.w, band.y + band.d, band.z], [band.x, band.y + band.d, band.z]], s.left, 1, 0.02);
      m.poly([[band.x + band.w, band.y + band.d, bt], [band.x + band.w, band.y, bt], [band.x + band.w, band.y, band.z], [band.x + band.w, band.y + band.d, band.z]], s.right, 1, 0.02);
    }
    if (v.cabin) {
      const alongX = box.w >= box.d;
      m.box(
        {
          x: box.x + (alongX ? box.w * 0.3 : box.w * 0.1),
          y: box.y + (alongX ? box.d * 0.1 : box.d * 0.3),
          w: alongX ? box.w * 0.45 : box.w * 0.8,
          d: alongX ? box.d * 0.8 : box.d * 0.45,
          z: box.z + v.h,
          h: 4,
        },
        p.shades(hex("#2b3340")),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Places that bet bubbles can attach to
// ---------------------------------------------------------------------------

export interface Anchor {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  /** Lower-cased substrings; a market whose question contains one lands here. */
  keywords: readonly string[];
  /** Preferred when choosing which bubbles to show. */
  primary?: boolean;
}

export const ANCHORS: readonly Anchor[] = [
  { id: "saieh", label: "Saieh Hall", x: 10.8, y: 12.2, z: 150, keywords: ["min sok lee", "econ", "saieh", "midterm"], primary: true },
  { id: "reg", label: "The Reg", x: 5.8, y: 8.1, z: 76, keywords: ["the reg", "reg hit", "regenstein", "reg "], primary: true },
  { id: "rockefeller", label: "Rockefeller Chapel", x: 13.2, y: 15.8, z: 215, keywords: ["rockefeller", "carillon", "chapel"] },
  { id: "stagg", label: "Stagg Field", x: 1.7, y: 3.5, z: 26, keywords: ["maroons", "stagg", "football", "track meet"], primary: true },
  { id: "ida-noyes", label: "Ida Noyes", x: 16.3, y: 16.3, z: 62, keywords: ["the pub", "pub ", "trivia", "doc films", "ida noyes", "pretzel"], primary: true },
  { id: "pond", label: "Botany Pond", x: 7.3, y: 11.7, z: 12, keywords: ["botany", "pond"] },
  { id: "rink", label: "Midway rink", x: 13.5, y: 19.5, z: 10, keywords: ["rink", "midway", "skating"] },
  { id: "bus", label: "55th Street", x: 6.5, y: 1.5, z: 22, keywords: ["55 bus", "bus "] },
  { id: "metra", label: "59th St Metra", x: 22.2, y: 17.1, z: 36, keywords: ["metra"] },
  { id: "bartlett", label: "Bartlett", x: 11.4, y: 8.2, z: 66, keywords: ["bartlett", "dining", "tikka", "omelet", "brunch"] },
  { id: "ratner", label: "Ratner", x: 6.4, y: 3.5, z: 100, keywords: ["ratner", "squat", "gym", "lap swim"] },
  { id: "booth", label: "Booth", x: 16.5, y: 14.9, z: 70, keywords: ["booth", "atrium", "mba", "harper center"] },
  { id: "maxp", label: "Max P", x: 6.0, y: 6.6, z: 58, keywords: ["max p", "palevsky", "fire alarm"] },
  { id: "logan", label: "Logan Center", x: 1.05, y: 23.0, z: 150, keywords: ["logan", "screening", "theater", "rooftop"] },
  { id: "harper", label: "Harper Library", x: 6.5, y: 16.2, z: 85, keywords: ["harper", "reading period", "finals"] },
  { id: "law", label: "Law School", x: 12.0, y: 23.3, z: 82, keywords: ["law school", "fountain", "law "] },
  { id: "mansueto", label: "Mansueto", x: 8.15, y: 8.15, z: 40, keywords: ["mansueto"] },
  { id: "hutch", label: "Hutch", x: 8.4, y: 10.5, z: 140, keywords: ["hutch", "reynolds", "mitchell", "c-shop", "bells"] },
  { id: "quad", label: "The Quad", x: 6.5, y: 13.4, z: 18, keywords: ["quad", "hull gate", "scav", "hammock", "campus"] },
  { id: "campus-north", label: "Campus North", x: 11.0, y: 3.5, z: 140, keywords: ["campus north", "elevator"] },
  { id: "ihouse", label: "I-House", x: 20.4, y: 15.0, z: 135, keywords: ["i-house", "international house"] },
  { id: "bj", label: "Burton-Judson", x: 6.5, y: 23.0, z: 70, keywords: ["cathey", "burton", "b-j", "judson"] },
  { id: "crerar", label: "Crerar", x: 1.5, y: 11.5, z: 56, keywords: ["crerar", "pset", "problem set", "physics"] },
  { id: "robie", label: "Robie House", x: 16.3, y: 12.4, z: 40, keywords: ["robie", "wright"] },
  { id: "sky", label: "Hyde Park sky", x: 17.5, y: 19.5, z: 70, keywords: ["rain", "snow", "frost", "weather", "°f", "wind", "sunny"] },
];

/** Where a market with no keyword match goes, by category. */
export const CATEGORY_ANCHOR: Record<string, string> = {
  sports: "stagg",
  campus: "quad",
  news: "sky",
  culture: "logan",
  crypto: "booth",
  other: "hutch",
};

export { VIEW_H, VIEW_W };
