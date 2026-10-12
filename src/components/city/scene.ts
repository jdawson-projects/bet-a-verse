// The University of Chicago campus, Hyde Park, as pixel-art geometry.
// Campus grid: x east (Ellis → the Metra tracks), y south (55th → 60th Street).
// Streets: rows y = 1 (55th), 5 (56th), 9 (57th), 13 (58th), 17 (59th), 21 (60th);
// columns x = 3 (Ellis), 9 (University), 14 (Woodlawn), 18 (Dorchester).
// Nothing is to scale; it's a map a student would recognize.
//
// The camera looks from the north-east, so Campus North, the Reg, Mansueto's
// dome and Saieh Hall sit in front and the quad and Rockefeller rise behind.
// The drawing code (Mesh) assumes a camera at +x+y, so campus coordinates go
// through `T`/`tb`/`tp` (a y-flip) on the way in.

import { GRID, GROUND, project, VIEW_H, VIEW_W, type BoxSpec, type P3, type Pt } from "./iso";
import { Mesh } from "./mesh";
import { hex, mix, type Palette, type RGB, type Shades } from "./palette";

/** Campus (x east, y south) → camera space. */
export const toScene = (x: number, y: number): Pt => [x, GRID - y];
const T = toScene;
const tp = (p: P3): P3 => [p[0], GRID - p[1], p[2]];
const tpt = (p: Pt): Pt => [p[0], GRID - p[1]];
const tb = (b: BoxSpec): BoxSpec => ({ ...b, y: GRID - b.y - b.d });

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const LIMESTONE = hex("#dbd4c1");
const LIMESTONE_DARK = hex("#cbc2aa");
const TILE_ROOF = hex("#cf5a2e");
const TILE_ROOF_DEEP = hex("#b94d28");
const SLATE = hex("#5a6374");
const BRICK = hex("#a4523d");
const GLASS = hex("#8fb8dc");
const WHITE = hex("#eef0eb");
const CONCRETE = hex("#d0cabb");
const CHIMNEY = hex("#9c8a6e");
const SHIRTS = ["#7a1d2b", "#1f3a8a", "#f2f2f0", "#f0c330", "#2f7d4f", "#2b3340", "#c45f8a"].map(hex);
const SKIN = ["#f1c9a5", "#c98a5e", "#8d5a3b", "#5a3a26"].map(hex);

type Skin = "none" | "grid" | "gothic" | "slits";

/** A thing on the map. Ground props draw at scale 1; the rest grow in. */
export interface Prop {
  id: string;
  rises: boolean;
  draw: (m: Mesh, p: Palette) => void;
}

const SKY_BIAS = 300;
const TILE_ROWS = 3.5;

// ---------------------------------------------------------------------------
// Building parts
// ---------------------------------------------------------------------------

function frac(n: number) {
  return n - Math.floor(n);
}

function hash(seed: number) {
  return frac(Math.sin(seed * 12.9898) * 43758.5453);
}

/** Lit or dark at night, decided once per window so the pattern is stable. */
function windowColor(p: Palette, seed: number): { c: RGB; a: number } {
  if (!p.night) return { c: p.window, a: p.windowAlpha };
  return hash(seed) < 0.7 ? { c: p.windowLit, a: 1 } : { c: p.windowDark, a: 1 };
}

/** Windows on the two visible faces. Gothic ones are paired lancets with pointed tops. */
function windows(m: Mesh, b: BoxSpec, skin: Skin, p: Palette) {
  if (skin === "none") return;
  const gothic = skin === "gothic";
  const colStep = skin === "slits" ? 0.16 : gothic ? 0.3 : 0.22;
  const ww = skin === "slits" ? 0.05 : gothic ? 0.065 : 0.1;
  const rowStep = gothic ? 10 : 7;
  const wh = gothic ? 5 : 3.2;
  const top = b.z + b.h;
  const bias = 0.02;

  const lancet = (quad: P3[], seed: number) => {
    const { c, a } = windowColor(p, seed);
    m.poly(quad, c, skin === "slits" && !p.night ? 0.35 : a, bias);
    if (gothic) {
      const [q0, q1, q2, q3] = quad;
      m.tri(q3, q2, [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, q2[2] + 1.6], c, a, bias);
    }
  };

  // Left face: plane y = b.y + b.d, columns along x.
  const yL = b.y + b.d;
  for (let x = b.x + 0.1; x + ww * 2 + 0.03 <= b.x + b.w - 0.08; x += colStep) {
    if (skin === "slits") {
      lancet([[x, yL, b.z + 2], [x + ww, yL, b.z + 2], [x + ww, yL, top - 2], [x, yL, top - 2]], x * 7 + b.y);
      continue;
    }
    for (let z = b.z + 4; z + wh <= top - 3; z += rowStep) {
      lancet([[x, yL, z], [x + ww, yL, z], [x + ww, yL, z + wh], [x, yL, z + wh]], x * 7 + z * 13 + b.y);
      if (gothic) {
        const x2 = x + ww + 0.03;
        lancet([[x2, yL, z], [x2 + ww, yL, z], [x2 + ww, yL, z + wh], [x2, yL, z + wh]], x * 7 + z * 13 + b.y + 1);
      }
    }
  }
  // Right face: plane x = b.x + b.w, columns along y.
  const xR = b.x + b.w;
  for (let y = b.y + 0.1; y + ww * 2 + 0.03 <= b.y + b.d - 0.08; y += colStep) {
    if (skin === "slits") {
      lancet([[xR, y + ww, b.z + 2], [xR, y, b.z + 2], [xR, y, top - 2], [xR, y + ww, top - 2]], y * 11 + b.x);
      continue;
    }
    for (let z = b.z + 4; z + wh <= top - 3; z += rowStep) {
      lancet([[xR, y + ww, z], [xR, y, z], [xR, y, z + wh], [xR, y + ww, z + wh]], y * 11 + z * 17 + b.x);
      if (gothic) {
        const y2 = y + ww + 0.03;
        lancet([[xR, y2 + ww, z], [xR, y2, z], [xR, y2, z + wh], [xR, y2 + ww, z + wh]], y * 11 + z * 17 + b.x + 1);
      }
    }
  }
}

/** Faint horizontal joints so walls read as cut stone. */
function courses(m: Mesh, b: BoxSpec, s: Shades) {
  const top = b.z + b.h;
  for (let z = b.z + 4; z < top - 2; z += 4) {
    m.line([b.x, b.y + b.d, z], [b.x + b.w, b.y + b.d, z], 1, s.edge, 0.16, 0.01);
    m.line([b.x + b.w, b.y + b.d, z], [b.x + b.w, b.y, z], 1, s.edge, 0.22, 0.01);
  }
}

/** Stone ribs against the two visible walls. */
function buttresses(m: Mesh, b: BoxSpec, s: Shades) {
  const h = b.h * 0.7;
  for (let x = b.x + 0.25; x + 0.12 < b.x + b.w - 0.15; x += 0.6) {
    m.box({ x, y: b.y + b.d, w: 0.12, d: 0.1, z: b.z, h }, s);
  }
  for (let y = b.y + 0.25; y + 0.12 < b.y + b.d - 0.15; y += 0.6) {
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

/** Small gabled windows poking out of the near roof slope. */
function dormers(m: Mesh, b: BoxSpec, axis: "x" | "y", rise: number, wall: Shades, roof: Shades, p: Palette) {
  const t = b.z + b.h;
  const u = 0.42;
  const zBase = t + rise * u - 3;
  const count = (len: number) => Math.max(1, Math.floor(len / 0.75));
  if (axis === "x") {
    const n = count(b.w);
    const yc = b.y + b.d / 2;
    const yFront = yc + (b.d / 2) * (1 - u);
    for (let i = 0; i < n; i++) {
      const x = b.x + (b.w * (i + 0.5)) / n - 0.09;
      const box: BoxSpec = { x, y: yFront - 0.16, w: 0.18, d: 0.16, z: zBase, h: 6 };
      m.box(box, wall);
      m.gable(box, 3.5, "x", roof);
      const { c, a } = windowColor(p, x * 31 + b.y);
      m.poly([[x + 0.05, yFront, zBase + 1.5], [x + 0.13, yFront, zBase + 1.5], [x + 0.13, yFront, zBase + 5], [x + 0.05, yFront, zBase + 5]], c, a, 0.03);
    }
    return;
  }
  const n = count(b.d);
  const xc = b.x + b.w / 2;
  const xFront = xc + (b.w / 2) * (1 - u);
  for (let i = 0; i < n; i++) {
    const y = b.y + (b.d * (i + 0.5)) / n - 0.09;
    const box: BoxSpec = { x: xFront - 0.16, y, w: 0.16, d: 0.18, z: zBase, h: 6 };
    m.box(box, wall);
    m.gable(box, 3.5, "y", roof);
    const { c, a } = windowColor(p, y * 31 + b.x);
    m.poly([[xFront, y + 0.13, zBase + 1.5], [xFront, y + 0.05, zBase + 1.5], [xFront, y + 0.05, zBase + 5], [xFront, y + 0.13, zBase + 5]], c, a, 0.03);
  }
}

function chimney(m: Mesh, b: BoxSpec, axis: "x" | "y", rise: number, p: Palette) {
  const t = b.z + b.h;
  const s = p.shades(CHIMNEY);
  const z = t + rise * 0.55;
  const h = rise * 0.45 + 6;
  if (axis === "x") {
    m.box({ x: b.x + 0.14, y: b.y + b.d / 2 - 0.05, w: 0.1, d: 0.1, z, h }, s);
  } else {
    m.box({ x: b.x + b.w / 2 - 0.05, y: b.y + b.d - 0.24, w: 0.1, d: 0.1, z, h }, s);
  }
}

/** A round corner turret with a conical tile roof. */
function turret(m: Mesh, cx: number, cy: number, z: number, h: number, wall: Shades, roof: Shades, p: Palette) {
  const r = 0.17;
  m.prism(cx, cy, r, z, h, 8, wall);
  for (let zz = z + 6; zz < z + h - 4; zz += 10) {
    const { c, a } = windowColor(p, cx * 17 + zz);
    m.poly([[cx + r * 0.2, cy + r, zz], [cx + r * 0.6, cy + r * 0.85, zz], [cx + r * 0.6, cy + r * 0.85, zz + 4], [cx + r * 0.2, cy + r, zz + 4]], c, a, 0.04);
  }
  m.cone(cx, cy, r + 0.03, z + h, 11, 8, roof);
}

/** Ivy climbing the two visible walls in a few ragged patches. */
function ivy(m: Mesh, b: BoxSpec, p: Palette, seed: number) {
  const dark = mix(p.leaf, p.leafEdge, 0.55);
  const light = mix(p.leaf, p.leafLight, 0.35);
  const top = b.z + b.h;
  let n = seed;
  const rnd = () => hash((n += 1.7));
  const patch = (face: "left" | "right", at: number, span: number) => {
    const reach = top - b.z - 8 - rnd() * 10;
    for (let z = b.z + 1; z < b.z + reach; z += 2.2) {
      const taper = 1 - (z - b.z) / reach;
      const half = span * (0.35 + 0.65 * taper);
      const count = Math.max(1, Math.round(half * 22));
      for (let i = 0; i < count; i++) {
        const o = at + (rnd() - 0.5) * half * 2;
        const c = rnd() < 0.3 ? light : dark;
        if (face === "left") m.dot([o, b.y + b.d, z + rnd() * 1.5], 1.5, c, 1, 0.03);
        else m.dot([b.x + b.w, o, z + rnd() * 1.5], 1.5, c, 1, 0.03);
      }
    }
  };
  patch("left", b.x + 0.2 + rnd() * (b.w - 0.4), 0.22 + rnd() * 0.15);
  if (b.w > 1.2) patch("left", b.x + 0.2 + rnd() * (b.w - 0.4), 0.18 + rnd() * 0.12);
  patch("right", b.y + 0.2 + rnd() * (b.d - 0.4), 0.2 + rnd() * 0.15);
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
  circle(sx + r * 0.25, sy + r * 0.3, r * 0.35, 6, mix(p.leaf, p.leafEdge, 0.5), 0.004);
}

// ---------------------------------------------------------------------------
// Prop constructors
// ---------------------------------------------------------------------------

const props: Prop[] = [];
const add = (id: string, rises: boolean, draw: Prop["draw"]) => props.push({ id, rises, draw });

function building(id: string, b: Omit<BoxSpec, "z">, base: RGB, skin: Skin = "grid") {
  add(id, true, (m, p) => {
    const spec = tb({ ...b, z: GROUND });
    m.box(spec, p.shades(base));
    windows(m, spec, skin, p);
  });
}

interface GothicOpts {
  color?: RGB;
  roof?: RGB;
  buttress?: boolean;
  door?: boolean;
  dormers?: boolean;
  chimney?: boolean;
  /** Corners that get a round turret: front-left (D), front (C), right (B). */
  turrets?: ("D" | "C" | "B")[];
  ivy?: boolean;
}

/** Gothic hall: cut limestone, paired lancets, buttresses, a door, a clay-tile roof with dormers. */
function gothic(id: string, b: Omit<BoxSpec, "z">, axis: "x" | "y", rise = 14, opts: GothicOpts = {}) {
  const { color = LIMESTONE, roof = TILE_ROOF, buttress = true, door: hasDoor = true, dormers: hasDormers = true, chimney: hasChimney = true, turrets = [], ivy: hasIvy = false } = opts;
  add(id, true, (m, p) => {
    const spec = tb({ ...b, z: GROUND });
    const s = p.shades(color);
    const rs = p.roofShades(roof);
    m.box(spec, s);
    courses(m, spec, s);
    windows(m, spec, "gothic", p);
    if (buttress) buttresses(m, spec, s);
    if (hasDoor) door(m, spec, s);
    if (hasIvy) ivy(m, spec, p, spec.x * 3.1 + spec.y);
    m.gable(spec, rise, axis, rs, TILE_ROWS);
    if (hasDormers) dormers(m, spec, axis, rise, s, rs, p);
    if (hasChimney) chimney(m, spec, axis, rise, p);
    for (const corner of turrets) {
      const cx = corner === "D" ? spec.x : spec.x + spec.w;
      const cy = corner === "B" ? spec.y : spec.y + spec.d;
      turret(m, cx, cy, GROUND, b.h + rise * 0.6, s, rs, p);
    }
  });
}

function tower(id: string, b: Omit<BoxSpec, "z">, color = LIMESTONE, pinnacleH = 14, crenellated = true) {
  add(id, true, (m, p) => {
    const spec = tb({ ...b, z: GROUND });
    const s = p.shades(color);
    m.box(spec, s);
    courses(m, spec, s);
    windows(m, spec, "gothic", p);
    if (crenellated) merlons(m, spec, s);
    if (pinnacleH > 0) pinnacles(m, spec, s, pinnacleH);
  });
}

function trees(id: string, list: readonly (readonly [number, number, number?])[]) {
  add(id, true, (m, p) => {
    for (const [x, y, r] of list) tree(m, p, ...T(x, y), r);
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

/** A flat campus rectangle, in camera space. */
const flat = (x0: number, y0: number, x1: number, y1: number, z: number): P3[] => [
  [x0, GRID - y1, z],
  [x1, GRID - y1, z],
  [x1, GRID - y0, z],
  [x0, GRID - y0, z],
];

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

/** A narrow path between two ground points. */
function path(m: Mesh, p: Palette, ca: Pt, cb: Pt, width = 0.14) {
  const a = tpt(ca);
  const b = tpt(cb);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  const z = GROUND + 0.06;
  m.poly([[a[0] + nx, a[1] + ny, z], [b[0] + nx, b[1] + ny, z], [b[0] - nx, b[1] - ny, z], [a[0] - nx, a[1] - ny, z]], p.path);
}

add("ground", false, (m, p) => {
  // The slab and its edges
  const slab = p.shades(p.land);
  m.box({ x: 0, y: 0, w: 24, d: 24, z: 0, h: GROUND }, { top: p.land, left: p.landEdge, right: mix(p.landEdge, hex("#000000"), 0.2), edge: slab.edge });

  // Lawns and parks
  const park = (x0: number, y0: number, x1: number, y1: number, a = 1) => m.poly(flat(x0, y0, x1, y1, GROUND + 0.03), p.park, a);
  park(4, 10, 9, 17);
  park(0, 18, EAST_EDGE, 21);
  park(10, 10, 14, 13, 0.85);
  park(10, 14, 14, 17, 0.85);
  park(15, 11.6, 18, 13, 0.75);
  park(22.8, 0, 24, 24);
  park(0, 2, 3, 5);
  park(15.3, 10.2, 17.8, 11.4, 0.75);

  // Grass texture: scattered darker tufts
  const rand = seeded(11);
  const tuft = mix(p.park, p.leafEdge, 0.35);
  const lawns: [number, number, number, number][] = [
    [4.3, 10.3, 8.7, 16.7],
    [0.2, 18.2, EAST_EDGE - 0.2, 20.8],
    [10.3, 14.2, 13.7, 15.1],
    [0.3, 2.3, 2.7, 4.7],
  ];
  for (const [x0, y0, x1, y1] of lawns) {
    const n = Math.round((x1 - x0) * (y1 - y0) * 3.2);
    for (let i = 0; i < n; i++) {
      m.dot(tp([x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), GROUND + 0.05]), 1, tuft, 0.8);
    }
  }

  // Quad paths: a cross, the diagonals, and the circle where they meet
  const c: Pt = [6.5, 13.4];
  path(m, p, [6.5, 10.1], [6.5, 16.9], 0.22);
  path(m, p, [4.1, 13.4], [8.9, 13.4], 0.22);
  for (const corner of [
    [4.3, 10.3],
    [8.7, 10.3],
    [4.3, 16.7],
    [8.7, 16.7],
  ] as const) {
    path(m, p, corner, c);
  }
  m.ellipse(...T(c[0], c[1]), 0.5, 0.5, GROUND + 0.07, p.path);
  m.ellipse(...T(c[0], c[1]), 0.3, 0.3, GROUND + 0.09, p.park);
  path(m, p, [10.3, 16.9], [13.7, 14.3], 0.12);
  path(m, p, [10.3, 14.3], [13.7, 16.9], 0.12);

  // Streets with center dashes
  for (const y of STREET_ROWS) m.poly(flat(0, y, EAST_EDGE, y + 1, GROUND + 0.05), p.street);
  for (const x of STREET_COLS) m.poly(flat(x, 0, x + 1, 24, GROUND + 0.05), p.street);
  for (const y of STREET_ROWS) {
    for (let x = 0.4; x < EAST_EDGE - 0.5; x += 0.8) m.line(tp([x, y + 0.5, GROUND + 0.08]), tp([x + 0.32, y + 0.5, GROUND + 0.08]), 1, p.dash);
  }
  for (const x of STREET_COLS) {
    for (let y = 0.4; y < 23.6; y += 0.8) m.line(tp([x + 0.5, y, GROUND + 0.08]), tp([x + 0.5, y + 0.32, GROUND + 0.08]), 1, p.dash);
  }

  // Stagg Field: track oval, bleachers, goalposts
  const stagg = T(1.7, 3.5);
  m.ellipse(...stagg, 1.08, 1.12, GROUND + 0.07, p.track);
  m.ellipse(...stagg, 0.84, 0.88, GROUND + 0.09, p.park);
  m.ellipse(...stagg, 0.8, 0.84, GROUND + 0.1, p.fieldLine, 0.9);
  m.ellipse(...stagg, 0.74, 0.78, GROUND + 0.11, p.park);
  m.box(tb({ x: 0.25, y: 2.5, w: 0.3, d: 2, z: GROUND, h: 10 }), p.shades(hex("#8d94a3")));
  for (const gx of [1.0, 2.45]) {
    m.line(tp([gx, 3.5, GROUND]), tp([gx, 3.5, GROUND + 9]), 1, p.fieldLine);
    m.line(tp([gx - 0.18, 3.5, GROUND + 9]), tp([gx + 0.18, 3.5, GROUND + 9]), 1, p.fieldLine);
  }

  // Botany Pond, the Law School pool and fountain, the Midway rink
  m.ellipse(...T(7.3, 11.7), 0.5, 0.4, GROUND + 0.07, p.waterRim);
  m.ellipse(...T(7.3, 11.7), 0.42, 0.32, GROUND + 0.09, p.water);
  m.ellipse(...T(12.0, 22.45), 1.38, 0.34, GROUND + 0.07, p.waterRim);
  m.ellipse(...T(12.0, 22.45), 1.24, 0.25, GROUND + 0.09, p.water);
  m.dot(tp([12.0, 22.45, GROUND + 5]), 2, p.fountain);
  m.dot(tp([11.9, 22.45, GROUND + 3]), 1, p.fountain);
  m.dot(tp([12.1, 22.45, GROUND + 3]), 1, p.fountain);
  m.ellipse(...T(13.5, 19.5), 1.25, 0.58, GROUND + 0.07, mix(p.rink, p.land, 0.4));
  m.ellipse(...T(13.5, 19.5), 1.1, 0.48, GROUND + 0.09, p.rink);

  // The Metra embankment with two tracks and the 59th Street shelter
  const bermTop = GROUND + 14;
  m.box(tb({ x: 21.6, y: 0, w: 1.2, d: 24, z: GROUND, h: 14 }), p.shades(p.berm));
  for (let y = 0.3; y < 24; y += 0.5) m.line(tp([21.8, y, bermTop + 0.1]), tp([22.6, y, bermTop + 0.1]), 1, p.tie, 0.8, 0.02);
  for (const x of [21.95, 22.45]) m.line(tp([x, 0, bermTop + 0.2]), tp([x, 24, bermTop + 0.2]), 1, p.rail, 1, 0.03);
  m.box(tb({ x: 21.75, y: 16.6, w: 0.35, d: 1.1, z: bermTop, h: 9 }), p.shades(hex("#7f1d1d")));
});

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

// West of Ellis: labs and the Logan Center
gothic("jones", { x: 0.3, y: 6.3, w: 2.4, d: 1.0, h: 44 }, "x", 15, { turrets: ["C"] });
gothic("kent", { x: 0.3, y: 7.6, w: 1.0, d: 1.3, h: 40 }, "y", 14, { door: false });
gothic("kersten", { x: 0.3, y: 10.3, w: 2.3, d: 1.0, h: 42 }, "x", 14);
gothic("crerar", { x: 0.3, y: 11.6, w: 1.0, d: 1.2, h: 38 }, "y", 13, { door: false, turrets: ["D"] });
gothic("hinds", { x: 0.3, y: 14.3, w: 2.4, d: 1.0, h: 42 }, "x", 15, { turrets: ["C"] });
gothic("research", { x: 0.3, y: 15.6, w: 2.4, d: 1.0, h: 36 }, "x", 13, { door: false });
building("logan-tower", { x: 0.4, y: 22.3, w: 1.3, d: 1.4, h: 136 }, CONCRETE, "slits");
building("logan-wing", { x: 1.8, y: 22.3, w: 1.0, d: 1.4, h: 26 }, CONCRETE, "grid");

// Ratner: a low hall with masts and cables over the roof
add("ratner", true, (m, p) => {
  const b = tb({ x: 4.3, y: 2.4, w: 4.2, d: 2.2, z: GROUND, h: 30 });
  m.box(b, p.shades(hex("#e0e4e5")));
  windows(m, b, "slits", p);
  const cable = mix(p.shades(WHITE).right, p.land, 0.3);
  for (const x of [5.2, 6.4, 7.6]) {
    const top = tp([x, 3.5, GROUND + 92]);
    m.line(tp([x - 0.9, 2.4, GROUND + 30]), top, 1, cable, 0.9);
    m.line(tp([x + 0.9, 4.6, GROUND + 30]), top, 1, cable, 0.9);
    m.line(tp([x, 3.5, GROUND + 30]), top, 2, p.shades(WHITE).top);
  }
});

// Max P: three colored blocks
for (const [i, c] of ["#d9661f", "#b6433b", "#6e4a8e"].entries()) {
  building(`maxp-${i}`, { x: 4.2 + i * 1.55, y: 6.1, w: 1.35, d: 1.0, h: 44 }, hex(c), "grid");
}
building("reg", { x: 4.2, y: 7.4, w: 3.2, d: 1.5, h: 60 }, hex("#d8d1bf"), "slits");

// Mansueto: a glass dome beside the Reg
add("mansueto", true, (m, p) => {
  const [cx, cy] = T(8.15, 8.15);
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

// The main quad: long gothic ranges around the lawn
gothic("snell-hitchcock", { x: 4.2, y: 10.2, w: 1.9, d: 0.9, h: 42 }, "x", 14, { turrets: ["D"], ivy: true });
gothic("hull", { x: 6.3, y: 10.2, w: 0.9, d: 0.9, h: 38 }, "x", 12, { dormers: false, ivy: true });
gothic("reynolds", { x: 7.4, y: 10.2, w: 1.4, d: 0.9, h: 46 }, "x", 15, { door: false });
tower("mitchell", { x: 8.1, y: 10.2, w: 0.7, d: 0.7, h: 118 }, LIMESTONE, 12);
gothic("cobb", { x: 4.2, y: 11.4, w: 0.9, d: 2.1, h: 48 }, "y", 14, { turrets: ["D"], ivy: true });
gothic("ryerson", { x: 4.2, y: 13.8, w: 0.9, d: 1.6, h: 44 }, "y", 13, { door: false, ivy: true });
gothic("swift", { x: 7.9, y: 11.4, w: 0.9, d: 1.5, h: 46 }, "y", 14, { door: false, turrets: ["B"], ivy: true });
gothic("classics", { x: 7.9, y: 13.2, w: 0.9, d: 2.1, h: 42 }, "y", 13, { turrets: ["C"], ivy: true });
gothic("harper", { x: 5.4, y: 15.6, w: 2.2, d: 1.2, h: 52 }, "x", 17);
tower("harper-w", { x: 4.4, y: 15.6, w: 1.0, d: 1.2, h: 108 });
tower("harper-e", { x: 7.6, y: 15.6, w: 1.0, d: 1.2, h: 108 });

// South of the Midway, west side
gothic("burton-judson", { x: 4.3, y: 22.3, w: 4.4, d: 1.4, h: 44 }, "x", 15, { turrets: ["D", "C"] });
tower("bj-tower", { x: 6.2, y: 22.3, w: 0.7, d: 0.7, h: 78 }, LIMESTONE, 10);

// University → Woodlawn
add("campus-north", true, (m, p) => {
  const s = p.shades(WHITE);
  for (const b of [
    { x: 10.3, y: 2.3, w: 3.4, d: 2.4, z: GROUND, h: 22 },
    { x: 10.4, y: 2.4, w: 1.2, d: 2.2, z: GROUND + 22, h: 64 },
  ]) {
    const spec = tb(b);
    m.box(spec, s);
    windows(m, spec, "grid", p);
  }
});
gothic("crown-fieldhouse", { x: 10.3, y: 6.2, w: 3.4, d: 1.0, h: 36 }, "x", 14, { door: false });
gothic("bartlett", { x: 10.3, y: 7.6, w: 2.2, d: 1.2, h: 46 }, "x", 15, { turrets: ["C"], ivy: true });
gothic("saieh-main", { x: 11.4, y: 10.3, w: 2.1, d: 0.9, h: 42 }, "x", 14, { ivy: true });
gothic("saieh-wing", { x: 10.3, y: 10.3, w: 0.9, d: 1.3, h: 42 }, "y", 14, { door: false });
tower("saieh-tower", { x: 10.3, y: 11.7, w: 1.0, d: 1.0, h: 122 }, LIMESTONE_DARK, 12);
gothic("oriental-institute", { x: 11.9, y: 11.8, w: 1.8, d: 1.0, h: 40 }, "x", 13, { color: LIMESTONE_DARK, dormers: false });
gothic("rockefeller-nave", { x: 10.5, y: 15.3, w: 2.1, d: 1.3, h: 58 }, "x", 22, { roof: SLATE, dormers: false, chimney: false });
tower("rockefeller-tower", { x: 12.6, y: 15.1, w: 1.2, d: 1.5, h: 188 }, LIMESTONE, 18);

// The Law School: fluted glass by the pool
building("law", { x: 10.6, y: 22.9, w: 2.8, d: 1.0, h: 64 }, hex("#9fc2dd"), "slits");

// Woodlawn → Dorchester: gothic halls and courts
gothic("woodlawn-hall", { x: 15.2, y: 2.3, w: 1.0, d: 2.4, h: 40 }, "y", 14, { turrets: ["D"] });
gothic("dorchester-hall", { x: 16.6, y: 2.3, w: 1.0, d: 2.4, h: 44 }, "y", 15, { color: LIMESTONE_DARK });
gothic("court-north", { x: 15.2, y: 6.3, w: 2.5, d: 1.0, h: 42 }, "x", 15, { turrets: ["C"] });
gothic("court-south", { x: 15.2, y: 7.7, w: 1.0, d: 1.1, h: 36 }, "y", 13, { door: false });
gothic("hall-58th", { x: 15.2, y: 10.3, w: 2.4, d: 0.8, h: 36 }, "x", 13, { door: false, dormers: false });

// Robie House: long brick, deep flat roofs
add("robie", true, (m, p) => {
  const brick = p.shades(BRICK);
  const roof = p.shades(hex("#6f5040"));
  const base = tb({ x: 15.3, y: 12.0, w: 2.0, d: 0.75, z: GROUND, h: 12 });
  const upper = tb({ x: 15.9, y: 12.1, w: 1.1, d: 0.55, z: GROUND + 15, h: 10 });
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
  const b = tb({ x: 15.2, y: 14.2, w: 2.6, d: 1.4, z: GROUND, h: 44 });
  m.box(b, p.shades(GLASS));
  windows(m, b, "grid", p);
  const top = GROUND + 44;
  const post = p.shades(hex("#c9d1d8")).left;
  for (const [x, y] of [
    [15.15, 14.1],
    [17.85, 14.1],
    [17.85, 15.7],
  ] as const) {
    m.line(tp([x, y, top]), tp([x, y, top + 5]), 1, post);
  }
  m.box(tb({ x: 15.0, y: 14.0, w: 3.0, d: 1.8, z: top + 5, h: 3 }), p.shades(hex("#f4f5f2")));
});

gothic("ida-noyes", { x: 15.2, y: 15.9, w: 2.3, d: 0.9, h: 34 }, "x", 13, { color: hex("#a35b45"), buttress: false });
tower("ida-noyes-tower", { x: 17.0, y: 15.9, w: 0.6, d: 0.6, h: 56 }, hex("#a35b45"), 8);
gothic("seminary", { x: 15.3, y: 22.3, w: 2.4, d: 1.4, h: 42 }, "x", 15, { turrets: ["C"] });

// Dorchester → the tracks
gothic("hall-e1", { x: 19.2, y: 2.3, w: 1.0, d: 2.4, h: 36 }, "y", 13, { color: LIMESTONE_DARK, door: false });
gothic("hall-e2", { x: 20.4, y: 2.3, w: 1.0, d: 2.4, h: 32 }, "y", 12, { door: false, dormers: false });
gothic("hall-e3", { x: 19.2, y: 6.3, w: 2.2, d: 1.0, h: 44 }, "x", 15, { turrets: ["D"] });
gothic("hall-e4", { x: 19.2, y: 7.7, w: 1.0, d: 1.1, h: 36 }, "y", 13, { door: false });
gothic("hall-e5", { x: 19.2, y: 10.3, w: 1.0, d: 2.4, h: 46 }, "y", 15, { color: LIMESTONE_DARK });
gothic("hall-e6", { x: 20.4, y: 10.3, w: 1.0, d: 2.4, h: 40 }, "y", 14, { door: false });
gothic("ihouse", { x: 19.2, y: 14.3, w: 2.2, d: 2.3, h: 62 }, "x", 16, { color: hex("#cdbf9f"), roof: TILE_ROOF_DEEP, turrets: ["D", "C"] });
tower("ihouse-tower", { x: 19.9, y: 14.3, w: 1.0, d: 1.0, h: 116 }, hex("#cdbf9f"), 10);
gothic("hall-e7", { x: 19.2, y: 22.3, w: 2.2, d: 1.4, h: 38 }, "x", 14, { color: LIMESTONE_DARK, turrets: ["C"] });

// Trees: thick on the quad and the Midway, lining the avenues
trees("quad-trees", [
  [5.6, 12.0],
  [7.1, 12.5],
  [5.5, 14.7, 6],
  [7.4, 14.6],
  [6.0, 11.0, 4],
  [7.6, 12.9, 4],
  [5.3, 13.0, 4],
  [7.3, 15.4, 5],
  [5.7, 15.3, 4],
  [6.6, 11.4, 4],
]);
treeLine("midway-n", [0.6, 18.3], [21.0, 18.3], 1.3, 5);
treeLine("midway-s", [1.3, 20.7], [21.0, 20.7], 1.3, 5);
treeLine("ellis-w", [2.85, 5.8], [2.85, 16.6], 1.6, 4);
treeLine("university-e", [10.15, 5.6], [10.15, 9.0], 1.6, 4);
treeLine("woodlawn-w", [13.85, 5.6], [13.85, 16.8], 1.7, 4);
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
  [16.8, 11.0, 4],
  [20.6, 21.0, 4],
  [1.5, 17.5, 4],
  [9.0, 23.6, 4],
  [2.6, 1.6, 4],
  [17.6, 13.4, 4],
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

/** A closed loop given in campus coordinates. */
const loop = (...pts: Pt[]): Pt[] => pts.map(tpt);

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

// Students: a head over a shirt, two pixels tall, walking the quad and the Midway.
interface Walker {
  path: readonly Pt[];
  lens: number[];
  speed: number;
  offset: number;
  shirt: RGB;
  skin: RGB;
}

const WALKERS: readonly Walker[] = (() => {
  const rand = seeded(23);
  const routes: Pt[][] = [
    loop([6.5, 10.1], [6.5, 16.9]),
    loop([6.44, 16.9], [6.44, 10.1]),
    loop([4.1, 13.4], [8.9, 13.4]),
    loop([8.9, 13.46], [4.1, 13.46]),
    loop([4.3, 10.3], [6.5, 13.4], [8.7, 16.7]),
    loop([8.7, 10.3], [6.5, 13.4], [4.3, 16.7]),
    loop([4.3, 16.7], [6.5, 13.4]),
    loop([8.7, 10.3], [6.5, 13.4]),
    loop([0.5, 17.9], [21.4, 17.9]),
    loop([21.4, 18.05], [0.5, 18.05]),
    loop([0.5, 21.1], [21.4, 21.1]),
    loop([9.9, 5.2], [9.9, 16.8]),
    loop([13.9, 16.8], [13.9, 5.2]),
    loop([4.0, 9.2], [13.6, 9.2]),
    loop([13.6, 9.8], [4.0, 9.8]),
    loop([10.3, 16.9], [13.7, 14.3]),
    loop([13.7, 16.9], [10.3, 14.3]),
    loop([7.8, 9.2], [8.2, 7.2]),
  ];
  const out: Walker[] = [];
  for (const route of routes) {
    const n = 1 + Math.floor(rand() * 2.5);
    for (let i = 0; i < n; i++) {
      out.push({
        path: route,
        lens: pathLengths(route),
        speed: 0.45 + rand() * 0.35,
        offset: rand() * 30,
        shirt: SHIRTS[Math.floor(rand() * SHIRTS.length)],
        skin: SKIN[Math.floor(rand() * SKIN.length)],
      });
    }
  }
  return out;
})();

/** A point along a closed polyline, `dist` tiles from its start. */
function pointAt(path: readonly Pt[], lens: number[], dist: number): Pt {
  const total = lens.reduce((a, b) => a + b, 0);
  let d = dist % total;
  if (d < 0) d += total;
  let i = 0;
  while (d > lens[i]) {
    d -= lens[i];
    i = (i + 1) % lens.length;
  }
  const a = path[i];
  const b = path[(i + 1) % path.length];
  const u = lens[i] === 0 ? 0 : d / lens[i];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

function buildWalkers(m: Mesh, p: Palette, t: number) {
  for (const w of WALKERS) {
    const [x, y] = pointAt(w.path, w.lens, w.offset + w.speed * t);
    const bob = Math.abs(Math.sin((t * w.speed * 9) % Math.PI)) * 0.5;
    const shirt = p.night ? mix(w.shirt, hex("#0a0e1a"), 0.45) : w.shirt;
    const head = p.night ? mix(w.skin, hex("#0a0e1a"), 0.4) : w.skin;
    m.dot([x, y, GROUND + 1.6 + bob], 2.3, shirt, 1, 0.08);
    m.dot([x, y, GROUND + 4.6 + bob], 1.6, head, 1, 0.09);
    m.dot([x, y, GROUND + 0.4 + bob * 0.5], 1.4, mix(shirt, hex("#000000"), 0.6), 1, 0.08);
  }
}

export function buildVehicles(m: Mesh, p: Palette, t: number) {
  m.reset();
  buildWalkers(m, p, t);
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
  { id: "bartlett", label: "Bartlett", x: 11.4, y: 8.2, z: 72, keywords: ["bartlett", "dining", "tikka", "omelet", "brunch"] },
  { id: "ratner", label: "Ratner", x: 6.4, y: 3.5, z: 100, keywords: ["ratner", "squat", "gym", "lap swim"] },
  { id: "booth", label: "Booth", x: 16.5, y: 14.9, z: 70, keywords: ["booth", "atrium", "mba", "harper center"] },
  { id: "maxp", label: "Max P", x: 6.0, y: 6.6, z: 58, keywords: ["max p", "palevsky", "fire alarm"] },
  { id: "logan", label: "Logan Center", x: 1.05, y: 23.0, z: 150, keywords: ["logan", "screening", "theater", "rooftop"] },
  { id: "harper", label: "Harper Library", x: 6.5, y: 16.2, z: 85, keywords: ["harper", "reading period", "finals"] },
  { id: "law", label: "Law School", x: 12.0, y: 23.3, z: 82, keywords: ["law school", "fountain", "law "] },
  { id: "mansueto", label: "Mansueto", x: 8.15, y: 8.15, z: 40, keywords: ["mansueto"] },
  { id: "hutch", label: "Hutch", x: 8.4, y: 10.5, z: 140, keywords: ["hutch", "reynolds", "mitchell", "c-shop", "bells"] },
  { id: "quad", label: "The Quad", x: 6.5, y: 13.4, z: 18, keywords: ["quad", "hull gate", "scav", "hammock", "campus"] },
  { id: "campus-north", label: "Campus North", x: 11.0, y: 3.5, z: 120, keywords: ["campus north", "elevator"] },
  { id: "ihouse", label: "I-House", x: 20.4, y: 15.0, z: 135, keywords: ["i-house", "international house"] },
  { id: "bj", label: "Burton-Judson", x: 6.5, y: 23.0, z: 70, keywords: ["cathey", "burton", "b-j", "judson"] },
  { id: "crerar", label: "Crerar", x: 0.8, y: 12.2, z: 60, keywords: ["crerar", "pset", "problem set", "physics"] },
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
