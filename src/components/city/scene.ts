// The University of Chicago's landmarks as pixel-art geometry: the dozen
// buildings a student would recognize, arranged on a compact block, not a
// survey of Hyde Park. Campus coordinates run x east, y south on a 22×22 grid.
//
// The camera looks from the north-east, so Mansueto's dome and the Reg sit in
// front with Ratner's masts beside them, Saieh's tower in the center, the quad
// and Rockefeller behind, Booth and Robie House down the east side, and
// downtown as a faint wash on the horizon.
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
const SLATE = hex("#5a6374");
const BRICK = hex("#a4523d");
const CONCRETE = hex("#d6d0c0");
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

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

/** Lit or dark at night, decided once per window so the pattern is stable. */
function windowColor(p: Palette, seed: number): { c: RGB; a: number } {
  if (!p.night) return { c: p.window, a: p.windowAlpha };
  return hash(seed) < 0.7 ? { c: p.windowLit, a: 1 } : { c: p.windowDark, a: 1 };
}

interface WindowOpts {
  /** Taller rows for great halls and chapels. */
  tall?: boolean;
}

/** Windows on the two visible faces. Gothic ones are paired lancets with pointed tops. */
function windows(m: Mesh, b: BoxSpec, skin: Skin, p: Palette, opts: WindowOpts = {}) {
  if (skin === "none") return;
  const gothic = skin === "gothic";
  const colStep = skin === "slits" ? 0.14 : gothic ? 0.3 : 0.22;
  const ww = skin === "slits" ? 0.045 : gothic ? 0.065 : 0.1;
  const rowStep = gothic ? (opts.tall ? 22 : 10) : 7;
  const wh = gothic ? (opts.tall ? 15 : 5) : 3.2;
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
function courses(m: Mesh, b: BoxSpec, s: Shades, step = 4) {
  const top = b.z + b.h;
  for (let z = b.z + step; z < top - 2; z += step) {
    m.line([b.x, b.y + b.d, z], [b.x + b.w, b.y + b.d, z], 1, s.edge, 0.16, 0.01);
    m.line([b.x + b.w, b.y + b.d, z], [b.x + b.w, b.y, z], 1, s.edge, 0.22, 0.01);
  }
}

/** Stone ribs against the two visible walls, capped with a little pinnacle when `capped`. */
function buttresses(m: Mesh, b: BoxSpec, s: Shades, capped = false, step = 0.6) {
  const h = b.h * 0.72;
  const rib = (x: number, y: number, w: number, d: number) => {
    m.box({ x, y, w, d, z: b.z, h }, s);
    if (capped) m.box({ x, y, w, d, z: b.z + h, h: 6 }, s, { inset: Math.min(w, d) * 0.3 });
  };
  for (let x = b.x + 0.25; x + 0.12 < b.x + b.w - 0.15; x += step) rib(x, b.y + b.d, 0.12, 0.1);
  for (let y = b.y + 0.25; y + 0.12 < b.y + b.d - 0.15; y += step) rib(b.x + b.w, y, 0.1, 0.12);
}

/** Crenellated parapet along every top edge. */
function merlons(m: Mesh, b: BoxSpec, s: Shades) {
  const t = b.z + b.h;
  const sz = 0.08;
  for (let x = b.x; x + sz <= b.x + b.w + 0.001; x += 0.18) {
    m.box({ x, y: b.y + b.d - sz, w: sz, d: sz, z: t, h: 3 }, s, { outline: false });
    m.box({ x, y: b.y, w: sz, d: sz, z: t, h: 3 }, s, { outline: false });
  }
  for (let y = b.y; y + sz <= b.y + b.d + 0.001; y += 0.18) {
    m.box({ x: b.x + b.w - sz, y, w: sz, d: sz, z: t, h: 3 }, s, { outline: false });
    m.box({ x: b.x, y, w: sz, d: sz, z: t, h: 3 }, s, { outline: false });
  }
}

/** Corner pinnacles, plus mid-edge ones on wide towers (Magdalen style). */
function pinnacles(m: Mesh, b: BoxSpec, s: Shades, h = 14, mids = false) {
  const t = b.z + b.h;
  const sz = Math.min(b.w, b.d) * 0.2;
  const spots: [number, number][] = [
    [b.x, b.y],
    [b.x + b.w - sz, b.y],
    [b.x, b.y + b.d - sz],
    [b.x + b.w - sz, b.y + b.d - sz],
  ];
  if (mids) {
    spots.push([b.x + b.w / 2 - sz / 2, b.y], [b.x + b.w / 2 - sz / 2, b.y + b.d - sz], [b.x, b.y + b.d / 2 - sz / 2], [b.x + b.w - sz, b.y + b.d / 2 - sz / 2]);
  }
  for (const [x, y] of spots) m.box({ x, y, w: sz, d: sz, z: t, h }, s, { inset: sz * 0.32 });
}

/** A pointed-arch doorway on the front-left face. */
function door(m: Mesh, b: BoxSpec, s: Shades, w = 0.16, h = 8) {
  const y = b.y + b.d;
  const cx = b.x + b.w / 2;
  const c = s.edge;
  m.poly([[cx - w / 2, y, b.z], [cx + w / 2, y, b.z], [cx + w / 2, y, b.z + h], [cx - w / 2, y, b.z + h]], c, 1, 0.03);
  m.tri([cx - w / 2, y, b.z + h], [cx + w / 2, y, b.z + h], [cx, y, b.z + h + w * 16], c, 1, 0.03);
}

/** Small gabled windows poking out of the near roof slope. */
function dormers(m: Mesh, b: BoxSpec, axis: "x" | "y", rise: number, wall: Shades, roof: Shades, p: Palette) {
  const t = b.z + b.h;
  const u = 0.42;
  const zBase = t + rise * u - 3;
  const count = (len: number) => Math.max(1, Math.floor(len / 0.7));
  if (axis === "x") {
    const n = count(b.w);
    const yc = b.y + b.d / 2;
    const yFront = yc + (b.d / 2) * (1 - u);
    for (let i = 0; i < n; i++) {
      const x = b.x + (b.w * (i + 0.5)) / n - 0.09;
      const box: BoxSpec = { x, y: yFront - 0.16, w: 0.18, d: 0.16, z: zBase, h: 7 };
      m.box(box, wall);
      m.gable(box, 4, "x", roof);
      const { c, a } = windowColor(p, x * 31 + b.y);
      m.poly([[x + 0.05, yFront, zBase + 1.5], [x + 0.13, yFront, zBase + 1.5], [x + 0.13, yFront, zBase + 5.5], [x + 0.05, yFront, zBase + 5.5]], c, a, 0.03);
    }
    return;
  }
  const n = count(b.d);
  const xc = b.x + b.w / 2;
  const xFront = xc + (b.w / 2) * (1 - u);
  for (let i = 0; i < n; i++) {
    const y = b.y + (b.d * (i + 0.5)) / n - 0.09;
    const box: BoxSpec = { x: xFront - 0.16, y, w: 0.16, d: 0.18, z: zBase, h: 7 };
    m.box(box, wall);
    m.gable(box, 4, "y", roof);
    const { c, a } = windowColor(p, y * 31 + b.x);
    m.poly([[xFront, y + 0.13, zBase + 1.5], [xFront, y + 0.05, zBase + 1.5], [xFront, y + 0.05, zBase + 5.5], [xFront, y + 0.13, zBase + 5.5]], c, a, 0.03);
  }
}

function chimney(m: Mesh, b: BoxSpec, axis: "x" | "y", rise: number, p: Palette, at = 0.15) {
  const t = b.z + b.h;
  const s = p.shades(CHIMNEY);
  const z = t + rise * 0.55;
  const h = rise * 0.45 + 7;
  if (axis === "x") m.box({ x: b.x + b.w * at, y: b.y + b.d / 2 - 0.05, w: 0.1, d: 0.1, z, h }, s);
  else m.box({ x: b.x + b.w / 2 - 0.05, y: b.y + b.d * (1 - at), w: 0.1, d: 0.1, z, h }, s);
}

/** A round corner turret with a conical tile roof. */
function turret(m: Mesh, cx: number, cy: number, z: number, h: number, wall: Shades, roof: Shades, p: Palette, r = 0.17) {
  m.prism(cx, cy, r, z, h, 8, wall);
  for (let zz = z + 7; zz < z + h - 5; zz += 11) {
    const { c, a } = windowColor(p, cx * 17 + zz);
    m.poly([[cx + r * 0.2, cy + r, zz], [cx + r * 0.6, cy + r * 0.85, zz], [cx + r * 0.6, cy + r * 0.85, zz + 4.5], [cx + r * 0.2, cy + r, zz + 4.5]], c, a, 0.04);
  }
  m.cone(cx, cy, r + 0.03, z + h, r * 70, 8, roof);
}

/** A four-sided spire on a tower top. */
function spire(m: Mesh, b: BoxSpec, h: number, s: Shades) {
  m.cone(b.x + b.w / 2, b.y + b.d / 2, Math.min(b.w, b.d) * 0.62, b.z + b.h, h, 4, s);
}

/** Ivy climbing the two visible walls in a few ragged patches. */
function ivy(m: Mesh, b: BoxSpec, p: Palette, seed: number, heavy = false) {
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
  const patches = heavy ? 3 : 1;
  for (let i = 0; i < patches; i++) patch("left", b.x + 0.2 + rnd() * (b.w - 0.4), 0.22 + rnd() * 0.15);
  for (let i = 0; i < Math.max(1, patches - 1); i++) patch("right", b.y + 0.2 + rnd() * (b.d - 0.4), 0.2 + rnd() * 0.15);
}

/** A rose window on the front-left face: a dark disc with stone spokes. */
function roseWindow(m: Mesh, b: BoxSpec, z: number, r: number, s: Shades, p: Palette) {
  const y = b.y + b.d;
  const cx = b.x + b.w / 2;
  const n = 12;
  const ring = (rr: number, c: RGB, a: number, bias: number) => {
    const pts: P3[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      pts.push([cx + (rr / 40) * Math.cos(t), y, z + rr * Math.sin(t)]);
    }
    m.poly(pts, c, a, bias);
  };
  ring(r + 1.2, s.edge, 1, 0.03);
  const { c } = windowColor(p, cx * 9 + z);
  ring(r, c, 1, 0.035);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI;
    m.line([cx - (r / 40) * Math.cos(t), y, z - r * Math.sin(t)], [cx + (r / 40) * Math.cos(t), y, z + r * Math.sin(t)], 1, s.top, 1, 0.04);
  }
  ring(r * 0.3, s.top, 1, 0.045);
}

function tree(m: Mesh, p: Palette, x: number, y: number, r = 6) {
  const base: P3 = [x, y, GROUND];
  const topZ = GROUND + 6;
  m.line(base, [x, y, topZ], 1.2, p.trunk);
  const [sx, sy] = project(x, y, topZ + r * 0.9);
  const near = x + y + (topZ + r) / 20;
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

interface GothicOpts {
  color?: RGB;
  roof?: RGB;
  buttress?: boolean;
  cappedButtresses?: boolean;
  door?: boolean;
  dormers?: boolean;
  chimney?: boolean;
  /** Corners that get a round turret: front-left (D), front (C), right (B). */
  turrets?: ("D" | "C" | "B")[];
  ivy?: boolean | "heavy";
  tallWindows?: boolean;
}

/** Gothic hall: cut limestone, paired lancets, buttresses, a door, a clay-tile roof with dormers. */
function gothic(id: string, b: Omit<BoxSpec, "z">, axis: "x" | "y", rise = 16, opts: GothicOpts = {}) {
  const {
    color = LIMESTONE,
    roof = TILE_ROOF,
    buttress = true,
    cappedButtresses = false,
    door: hasDoor = true,
    dormers: hasDormers = true,
    chimney: hasChimney = true,
    turrets = [],
    ivy: hasIvy = false,
    tallWindows = false,
  } = opts;
  add(id, true, (m, p) => {
    const spec = tb({ ...b, z: GROUND });
    const s = p.shades(color);
    const rs = p.roofShades(roof);
    m.box(spec, s);
    courses(m, spec, s);
    windows(m, spec, "gothic", p, { tall: tallWindows });
    if (buttress) buttresses(m, spec, s, cappedButtresses);
    if (hasDoor) door(m, spec, s);
    if (hasIvy) ivy(m, spec, p, spec.x * 3.1 + spec.y, hasIvy === "heavy");
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

interface TowerOpts {
  color?: RGB;
  pinnacles?: number;
  midPinnacles?: boolean;
  crenellated?: boolean;
  spire?: number;
  belfry?: boolean;
}

function tower(id: string, b: Omit<BoxSpec, "z">, opts: TowerOpts = {}) {
  const { color = LIMESTONE, pinnacles: pinH = 16, midPinnacles = false, crenellated = true, spire: spireH = 0, belfry = true } = opts;
  add(id, true, (m, p) => {
    const spec = tb({ ...b, z: GROUND });
    const s = p.shades(color);
    m.box(spec, s);
    courses(m, spec, s);
    windows(m, spec, "gothic", p);
    if (belfry) {
      // Tall louvred openings near the top
      const yL = spec.y + spec.d;
      const xR = spec.x + spec.w;
      const top = spec.z + spec.h;
      const dark = s.edge;
      for (const [x0, x1] of [[spec.x + spec.w * 0.3, spec.x + spec.w * 0.45], [spec.x + spec.w * 0.55, spec.x + spec.w * 0.7]]) {
        m.poly([[x0, yL, top - 24], [x1, yL, top - 24], [x1, yL, top - 9], [x0, yL, top - 9]], dark, 1, 0.03);
      }
      for (const [y0, y1] of [[spec.y + spec.d * 0.3, spec.y + spec.d * 0.45], [spec.y + spec.d * 0.55, spec.y + spec.d * 0.7]]) {
        m.poly([[xR, y1, top - 24], [xR, y0, top - 24], [xR, y0, top - 9], [xR, y1, top - 9]], dark, 1, 0.03);
      }
    }
    if (crenellated) merlons(m, spec, s);
    if (pinH > 0) pinnacles(m, spec, s, pinH, midPinnacles);
    if (spireH > 0) spire(m, spec, spireH, p.roofShades(SLATE));
  });
}

function trees(id: string, list: readonly (readonly [number, number, number?])[]) {
  add(id, true, (m, p) => {
    for (const [x, y, r] of list) tree(m, p, ...T(x, y), r);
  });
}

function treeLine(id: string, from: Pt, to: Pt, step: number, r = 6) {
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

const STREET_W = 0.7;
const ROWS = [6, 14]; // 57th, 59th
const EAST_EDGE = 21.2;

/** A flat campus rectangle, in camera space. */
const flat = (x0: number, y0: number, x1: number, y1: number, z: number): P3[] => [
  [x0, GRID - y1, z],
  [x1, GRID - y1, z],
  [x1, GRID - y0, z],
  [x0, GRID - y0, z],
];

/** A narrow path between two campus points. */
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
  const slab = p.shades(p.land);
  m.box({ x: 0, y: 0, w: GRID, d: GRID, z: 0, h: GROUND }, { top: p.land, left: p.landEdge, right: mix(p.landEdge, hex("#000000"), 0.2), edge: slab.edge });

  // Lawns
  const park = (x0: number, y0: number, x1: number, y1: number, a = 1) => m.poly(flat(x0, y0, x1, y1, GROUND + 0.03), p.park, a);
  park(2.7, 6.7, 11.5, 14); // the quad
  park(0, 14.7, GRID, GRID); // the Midway and everything south
  park(12.2, 10.6, 15.9, 14, 0.85); // Rockefeller's lawn
  park(12.2, 6.7, 15.9, 7.3, 0.8);
  park(16.6, 6.7, GRID, 10.5, 0.8); // the green north of Robie
  park(16.6, 13.3, GRID, 14, 0.8);
  park(0, 0, 9.3, 5.8, 0.7); // the field by Ratner
  park(0, 6.7, 2, 14, 0.8);
  park(17.4, 0, GRID, 5.8, 0.75); // east green by Mansueto

  const rand = seeded(11);
  const tuft = mix(p.park, p.leafEdge, 0.35);
  for (const [x0, y0, x1, y1] of [
    [3.0, 7.0, 11.2, 13.7],
    [0.2, 14.9, GRID - 0.2, 18.3],
    [12.4, 10.8, 15.7, 13.8],
    [17.6, 0.3, GRID - 0.3, 5.6],
    [0.3, 3.3, 2.8, 5.6],
    [0.3, 18.8, GRID - 0.3, GRID - 0.3],
  ] as const) {
    const n = Math.round((x1 - x0) * (y1 - y0) * 2.6);
    for (let i = 0; i < n; i++) m.dot(tp([x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), GROUND + 0.05]), 1, tuft, 0.8);
  }

  // Quad paths: cross, diagonals, the circle
  const c: Pt = [7.1, 10.5];
  path(m, p, [7.1, 6.8], [7.1, 13.9], 0.24);
  path(m, p, [2.8, 10.5], [11.4, 10.5], 0.24);
  for (const corner of [
    [3.4, 7.3],
    [10.8, 7.3],
    [3.4, 13.7],
    [10.8, 13.7],
  ] as const) {
    path(m, p, corner, c, 0.15);
  }
  m.ellipse(...T(c[0], c[1]), 0.55, 0.55, GROUND + 0.07, p.path);
  m.ellipse(...T(c[0], c[1]), 0.32, 0.32, GROUND + 0.09, p.park);
  // Mansueto's forecourt, the Midway promenade, Rockefeller's walk
  path(m, p, [15.1, 5.1], [15.1, 6.0], 0.3);
  path(m, p, [0.3, 16.6], [GRID - 0.3, 16.6], 0.16);
  path(m, p, [12.6, 13.9], [14.4, 10.9], 0.14);
  path(m, p, [9.0, 0.6], [9.0, 5.9], 0.16);

  // Streets with center dashes
  const streets: [number, number, number, number][] = [
    ...ROWS.map((y): [number, number, number, number] => [0, y, EAST_EDGE, y + STREET_W]),
    [2.0, 0, 2.0 + STREET_W, 14.7],
    [11.5, 6, 11.5 + STREET_W, 14.7],
    [15.9, 6, 15.9 + STREET_W, 14.7],
  ];
  for (const [x0, y0, x1, y1] of streets) m.poly(flat(x0, y0, x1, y1, GROUND + 0.05), p.street);
  for (const [x0, y0, x1, y1] of streets) {
    const horizontal = x1 - x0 > y1 - y0;
    if (horizontal) {
      const y = (y0 + y1) / 2;
      for (let x = x0 + 0.4; x < x1 - 0.5; x += 0.8) m.line(tp([x, y, GROUND + 0.08]), tp([x + 0.32, y, GROUND + 0.08]), 1, p.dash);
    } else {
      const x = (x0 + x1) / 2;
      for (let y = y0 + 0.4; y < y1 - 0.5; y += 0.8) m.line(tp([x, y, GROUND + 0.08]), tp([x, y + 0.32, GROUND + 0.08]), 1, p.dash);
    }
  }

  // Botany Pond with lily pads and a stone edge
  m.ellipse(...T(6.6, 9.1), 0.62, 0.48, GROUND + 0.07, p.waterRim);
  m.ellipse(...T(6.6, 9.1), 0.52, 0.38, GROUND + 0.09, p.water);
  for (const [dx, dy] of [
    [-0.2, 0.1],
    [0.15, -0.12],
    [0.28, 0.14],
    [-0.05, 0.2],
  ]) {
    m.dot(tp([6.6 + dx, 9.1 + dy, GROUND + 0.12]), 1.6, p.leafLight, 1, 0.01);
  }

  // The Midway rink
  m.ellipse(...T(9.5, 16.6), 1.35, 0.6, GROUND + 0.07, mix(p.rink, p.land, 0.4));
  m.ellipse(...T(9.5, 16.6), 1.2, 0.5, GROUND + 0.09, p.rink);

  // Stagg-side running track in the field by Ratner
  m.ellipse(...T(1.6, 1.9), 0.95, 0.75, GROUND + 0.07, p.track);
  m.ellipse(...T(1.6, 1.9), 0.72, 0.52, GROUND + 0.09, p.park);
});

// ---------------------------------------------------------------------------
// The landmarks
// ---------------------------------------------------------------------------

// --- Mansueto: an elliptical glass dome, long axis toward the viewer ----------
add("mansueto", true, (m, p) => {
  const [cx, cy] = T(15.2, 3.0);
  const rx = 1.2;
  const ry = 1.95;
  const h = 42;
  const rings = 10;
  const glass = p.shades(p.glass);
  const grid = p.night ? mix(p.glass, hex("#ffffff"), 0.35) : mix(p.glass, hex("#1b3450"), 0.45);
  const ringAt = (i: number) => {
    const t = i / rings;
    const k = Math.sqrt(1 - t * t);
    return { rx: rx * k, ry: ry * k, z: GROUND + h * t };
  };
  for (let i = 0; i < rings; i++) {
    const r = ringAt(i);
    m.ellipse(cx, cy, r.rx, r.ry, r.z, mix(glass.left, glass.top, i / rings), 1, 0.01 * i, 28);
  }
  const N = 28;
  for (let i = 1; i < rings; i++) {
    const r = ringAt(i);
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      m.line([cx + r.rx * Math.cos(a0), cy + r.ry * Math.sin(a0), r.z], [cx + r.rx * Math.cos(a1), cy + r.ry * Math.sin(a1), r.z], 1, grid, 0.75, 0.02 + 0.01 * i);
    }
  }
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    for (let i = 0; i < rings - 1; i++) {
      const r0 = ringAt(i);
      const r1 = ringAt(i + 1);
      m.line([cx + r0.rx * Math.cos(a), cy + r0.ry * Math.sin(a), r0.z], [cx + r1.rx * Math.cos(a), cy + r1.ry * Math.sin(a), r1.z], 1, grid, 0.75, 0.02 + 0.01 * i);
    }
  }
  m.ellipse(cx, cy, rx * 0.2, ry * 0.2, GROUND + h - 1, glass.top, 1, 0.12, 12);
  m.ellipse(cx + rx * 0.3, cy + ry * 0.35, rx * 0.14, ry * 0.12, GROUND + h * 0.6, hex("#ffffff"), p.night ? 0.25 : 0.55, 0.13, 10);
  m.ellipse(cx, cy, rx + 0.12, ry + 0.12, GROUND + 0.04, p.waterRim, 1, 0, 28);
  // The reading-room link to the Reg
  m.box({ x: cx - rx - 0.75, y: cy - 0.35, w: 0.8, d: 0.7, z: GROUND, h: 12 }, p.shades(CONCRETE));
});

// --- The Reg: Netsch's brutalist limestone, stepped masses and deep fins -------
add("reg", true, (m, p) => {
  const stone = p.shades(hex("#d9d2c0"));
  const fin = p.shades(hex("#c7bfac"));
  const dark = p.shades(hex("#b9b19e"));
  // Walls of narrow glass slots between heavy limestone fins
  const ribbed = (b: BoxSpec, finH: number) => {
    m.box(b, stone);
    windows(m, b, "slits", p);
    for (let x = b.x + 0.2; x < b.x + b.w - 0.1; x += 0.36) m.box({ x, y: b.y + b.d, w: 0.09, d: 0.08, z: b.z, h: finH }, fin, { outline: false });
    for (let y = b.y + 0.2; y < b.y + b.d - 0.1; y += 0.36) m.box({ x: b.x + b.w, y, w: 0.08, d: 0.09, z: b.z, h: finH }, fin, { outline: false });
    // Cornice band
    m.box({ x: b.x - 0.04, y: b.y - 0.04, w: b.w + 0.08, d: b.d + 0.08, z: b.z + b.h, h: 4 }, dark);
  };
  const main = tb({ x: 9.4, y: 1.3, w: 3.7, d: 2.6, z: GROUND, h: 66 });
  ribbed(main, 62);
  // The lower south wing and the entrance block (the A-level) stepping down toward 57th
  const wing = tb({ x: 9.8, y: 3.9, w: 3.1, d: 0.9, z: GROUND, h: 34 });
  ribbed(wing, 30);
  const entrance = tb({ x: 10.6, y: 4.8, w: 1.5, d: 0.5, z: GROUND, h: 18 });
  m.box(entrance, dark);
  door(m, entrance, dark, 0.5, 9);
  // Setback top floor and rooftop plant
  const upper = tb({ x: 9.9, y: 1.6, w: 2.7, d: 1.9, z: GROUND + 70, h: 16 });
  ribbed(upper, 13);
  m.box(tb({ x: 10.3, y: 2.0, w: 0.7, d: 0.5, z: GROUND + 90, h: 6 }), dark, { outline: false });
  m.box(tb({ x: 11.6, y: 2.3, w: 0.5, d: 0.5, z: GROUND + 90, h: 4 }), dark, { outline: false });
  // Entrance plaza steps
  for (let i = 0; i < 3; i++) m.box(tb({ x: 10.4 - i * 0.12, y: 5.3 + i * 0.1, w: 1.9 + i * 0.24, d: 0.1, z: GROUND, h: 2.5 - i * 0.7 }), stone, { outline: false });
});

// --- Ratner: a glass hall under a cable-hung roof that sags between tall masts ---
add("ratner", true, (m, p) => {
  const base = tb({ x: 3.0, y: 0.5, w: 4.8, d: 2.5, z: GROUND, h: 30 });
  const glass = p.shades(hex("#a9c6dd"));
  const steel = p.shades(hex("#e8ebed"));
  const roofC = p.shades(hex("#c9ced6"));
  const cable = mix(hex("#9aa3b0"), p.land, 0.2);
  // Mast positions along the spine (camera x), roof peaks under each
  const masts = [base.x + 0.7, base.x + 2.4, base.x + 4.1];
  const spineY = base.y + base.d * 0.45;
  const roofZ = (x: number) => {
    // Highest at the masts, sagging to a valley between them
    let best = 0;
    for (const mx of masts) best = Math.max(best, Math.max(0, 1 - Math.abs(x - mx) / 0.85));
    return GROUND + 30 + 16 * best;
  };
  // Glass walls with a wavy top edge
  const steps = 24;
  const yL = base.y + base.d;
  for (let i = 0; i < steps; i++) {
    const x0 = base.x + (base.w * i) / steps;
    const x1 = base.x + (base.w * (i + 1)) / steps;
    m.poly([[x0, yL, GROUND], [x1, yL, GROUND], [x1, yL, roofZ(x1) - 3], [x0, yL, roofZ(x0) - 3]], glass.left);
    m.poly([[x0, yL, roofZ(x0) - 3], [x1, yL, roofZ(x1) - 3], [x1, spineY, roofZ(x1)], [x0, spineY, roofZ(x0)]], roofC.left);
    m.poly([[x0, spineY, roofZ(x0)], [x1, spineY, roofZ(x1)], [x1, base.y, roofZ(x1) - 3], [x0, base.y, roofZ(x0) - 3]], roofC.top);
    m.line([x0, yL, roofZ(x0) - 3], [x1, yL, roofZ(x1) - 3], 1, glass.edge, 1, 0.03);
    m.line([x0, spineY, roofZ(x0)], [x1, spineY, roofZ(x1)], 1, roofC.edge, 1, 0.03);
  }
  const xR = base.x + base.w;
  m.poly([[xR, yL, GROUND], [xR, base.y, GROUND], [xR, base.y, roofZ(xR) - 3], [xR, spineY, roofZ(xR)], [xR, yL, roofZ(xR) - 3]], glass.right);
  // Mullions on the long glass wall
  for (let x = base.x + 0.15; x < xR; x += 0.15) m.line([x, yL, GROUND], [x, yL, roofZ(x) - 3], 1, glass.edge, 0.45, 0.02);
  for (let z = GROUND + 6; z < GROUND + 27; z += 6) m.line([base.x, yL, z], [xR, yL, z], 1, glass.edge, 0.45, 0.02);
  // Masts and the cables fanning to the roof edges
  for (const mx of masts) {
    const top: P3 = [mx, spineY, GROUND + 112];
    m.line([mx, spineY, roofZ(mx)], top, 2.4, steel.top);
    m.line([mx, spineY, roofZ(mx)], top, 1, steel.edge, 0.5, 0.03);
    for (const dx of [-0.6, -0.3, 0, 0.3, 0.6]) {
      m.line(top, [mx + dx, yL, roofZ(mx + dx) - 3], 1, cable, 0.9, 0.02);
      m.line(top, [mx + dx, base.y, roofZ(mx + dx) - 3], 1, cable, 0.9, 0.02);
    }
  }
  door(m, base, glass, 0.3, 9);
});

// --- The main quad ---------------------------------------------------------

gothic("hull", { x: 4.6, y: 6.9, w: 2.4, d: 1.0, h: 48 }, "x", 16, { ivy: "heavy", turrets: ["D"], chimney: false });
gothic("hutch", { x: 7.3, y: 6.9, w: 1.8, d: 1.25, h: 56 }, "x", 28, { door: false, dormers: false, tallWindows: true, cappedButtresses: true });
gothic("reynolds", { x: 9.3, y: 6.9, w: 1.3, d: 1.0, h: 50 }, "x", 16, { dormers: false, ivy: true });
tower("mitchell", { x: 10.4, y: 6.9, w: 1.0, d: 1.0, h: 150 }, { pinnacles: 20, midPinnacles: true });

add("hull-gate", true, (m, p) => {
  const s = p.shades(LIMESTONE_DARK);
  const gate = tb({ x: 6.8, y: 6.8, w: 0.6, d: 0.22, z: GROUND, h: 24 });
  m.box(gate, s);
  door(m, gate, s, 0.26, 14);
  merlons(m, gate, s);
  for (const x of [6.72, 7.32]) m.box(tb({ x, y: 6.76, w: 0.16, d: 0.3, z: GROUND, h: 30 }), s, { inset: 0.02 });
});

add("lamps", true, (m, p) => {
  const pole = p.shades(hex("#3b4150")).left;
  const lamp = p.night ? hex("#ffe9a8") : hex("#fff6d8");
  const spots: Pt[] = [];
  for (let y = 7.6; y < 13.6; y += 1.5) spots.push([7.3, y]);
  for (let x = 3.6; x < 11.2; x += 1.5) spots.push([x, 10.75]);
  for (let x = 1.0; x < GRID; x += 2.0) spots.push([x, 16.85]);
  for (const [x, y] of spots) {
    m.line(tp([x, y, GROUND]), tp([x, y, GROUND + 11]), 1, pole);
    m.dot(tp([x, y, GROUND + 12]), 1.8, lamp, 1, 0.05);
  }
});

add("flag", true, (m, p) => {
  const [x, y] = T(8.6, 8.55);
  m.line([x, y, GROUND], [x, y, GROUND + 52], 1.2, p.shades(hex("#d9dde6")).left);
  m.poly([[x, y, GROUND + 52], [x + 0.42, y, GROUND + 49], [x + 0.42, y, GROUND + 43], [x, y, GROUND + 46]], hex("#7a1d2b"), 1, 0.05);
});

gothic("cobb", { x: 2.9, y: 8.3, w: 1.0, d: 5.2, h: 56 }, "y", 16, { ivy: "heavy", turrets: ["D", "C"], chimney: false });
gothic("cobb-bay", { x: 3.0, y: 10.3, w: 1.15, d: 1.2, h: 72 }, "x", 18, { door: false, dormers: false, buttress: false, chimney: false });
gothic("classics", { x: 10.3, y: 8.3, w: 1.05, d: 3.8, h: 54 }, "y", 15, { ivy: true, turrets: ["B"], chimney: false });
gothic("harper", { x: 4.2, y: 12.5, w: 5.8, d: 1.4, h: 64 }, "x", 20, { tallWindows: true, cappedButtresses: true, ivy: true });
tower("harper-w", { x: 3.0, y: 12.4, w: 1.25, d: 1.5, h: 128 }, { pinnacles: 18 });
tower("harper-e", { x: 10.1, y: 12.4, w: 1.25, d: 1.5, h: 128 }, { pinnacles: 18 });

// --- Saieh Hall: the old seminary's tower and cloister ---------------------
gothic("saieh-main", { x: 12.4, y: 7.5, w: 3.3, d: 1.1, h: 52 }, "x", 17, { ivy: true, cappedButtresses: true });
gothic("saieh-wing", { x: 14.6, y: 8.6, w: 1.1, d: 1.6, h: 48 }, "y", 15, { door: false, dormers: false });
tower("saieh-tower", { x: 12.4, y: 8.6, w: 1.1, d: 1.1, h: 140 }, { color: LIMESTONE_DARK, pinnacles: 14, spire: 26 });
add("saieh-cloister", true, (m, p) => {
  const s = p.shades(LIMESTONE);
  const walls: BoxSpec[] = [
    tb({ x: 12.4, y: 9.7, w: 0.4, d: 0.9, z: GROUND, h: 18 }),
    tb({ x: 12.4, y: 10.2, w: 2.3, d: 0.4, z: GROUND, h: 18 }),
  ];
  for (const w of walls) {
    m.box(w, s);
    const yL = w.y + w.d;
    for (let x = w.x + 0.1; x + 0.12 < w.x + w.w; x += 0.2) {
      m.poly([[x, yL, GROUND], [x + 0.12, yL, GROUND], [x + 0.12, yL, GROUND + 11], [x, yL, GROUND + 11]], s.edge, 1, 0.03);
      m.tri([x, yL, GROUND + 11], [x + 0.12, yL, GROUND + 11], [x + 0.06, yL, GROUND + 13.5], s.edge, 1, 0.03);
    }
    const xR = w.x + w.w;
    for (let y = w.y + 0.1; y + 0.12 < w.y + w.d; y += 0.2) {
      m.poly([[xR, y + 0.12, GROUND], [xR, y, GROUND], [xR, y, GROUND + 11], [xR, y + 0.12, GROUND + 11]], s.edge, 1, 0.03);
    }
  }
  m.poly(flat(12.9, 8.7, 14.6, 10.2, GROUND + 0.04), p.park);
  m.ellipse(...T(13.75, 9.45), 0.25, 0.25, GROUND + 0.08, p.path);
});

// --- Rockefeller Chapel ------------------------------------------------------
add("rockefeller", true, (m, p) => {
  const s = p.shades(LIMESTONE);
  const roof = p.roofShades(SLATE);
  const nave = tb({ x: 12.5, y: 11.6, w: 2.4, d: 1.35, z: GROUND, h: 86 });
  m.box(nave, s);
  courses(m, nave, s, 5);
  windows(m, nave, "gothic", p, { tall: true });
  buttresses(m, nave, s, true, 0.5);
  m.gable(nave, 34, "x", roof);
  const transept = tb({ x: 13.9, y: 11.2, w: 1.2, d: 2.15, z: GROUND, h: 86 });
  m.box(transept, s);
  courses(m, transept, s, 5);
  buttresses(m, transept, s, true, 0.5);
  m.gable(transept, 34, "y", roof);
  roseWindow(m, transept, GROUND + 58, 13, s, p);
  door(m, transept, s, 0.22, 12);
  for (const pt of [tp([12.5, 12.27, GROUND + 120]), tp([14.9, 12.27, GROUND + 120]), tp([14.5, 11.2, GROUND + 120])]) {
    m.line(pt, [pt[0], pt[1], pt[2] + 7], 1.2, s.top);
  }
  const tw = tb({ x: 15.0, y: 11.5, w: 1.3, d: 1.5, z: GROUND, h: 225 });
  m.box(tw, s);
  courses(m, tw, s, 5);
  windows(m, tw, "gothic", p, { tall: true });
  buttresses(m, tw, s, false, 0.55);
  const belfryY = tw.y + tw.d;
  for (const [x0, x1] of [[tw.x + 0.25, tw.x + 0.5], [tw.x + 0.8, tw.x + 1.05]]) {
    m.poly([[x0, belfryY, GROUND + 190], [x1, belfryY, GROUND + 190], [x1, belfryY, GROUND + 214], [x0, belfryY, GROUND + 214]], s.edge, 1, 0.03);
  }
  const xR = tw.x + tw.w;
  for (const [y0, y1] of [[tw.y + 0.3, tw.y + 0.58], [tw.y + 0.92, tw.y + 1.2]]) {
    m.poly([[xR, y1, GROUND + 190], [xR, y0, GROUND + 190], [xR, y0, GROUND + 214], [xR, y1, GROUND + 214]], s.edge, 1, 0.03);
  }
  merlons(m, tw, s);
  pinnacles(m, tw, s, 26, true);
});

// --- Robie House, in full --------------------------------------------------
add("robie", true, (m, p) => {
  const brick = p.shades(BRICK);
  const mortar = mix(BRICK, hex("#ffffff"), 0.45);
  const coping = p.shades(hex("#d9d2bd"));
  const eave = p.shades(hex("#6a4b3c"));
  const base = tb({ x: 16.9, y: 8.3, w: 2.7, d: 0.95, z: GROUND, h: 14 });
  const main = tb({ x: 17.0, y: 8.35, w: 2.5, d: 0.85, z: GROUND + 16, h: 13 });
  const belvedere = tb({ x: 17.6, y: 8.47, w: 1.2, d: 0.55, z: GROUND + 31.5, h: 11 });
  const slab = (b: BoxSpec, over: number, z: number) =>
    m.box({ x: b.x - over, y: b.y - over * 0.55, w: b.w + over * 2, d: b.d + over * 1.1, z, h: 2.2 }, eave, { outline: true });
  const tier = (b: BoxSpec) => {
    m.box(b, brick);
    for (let z = b.z + 2.5; z < b.z + b.h - 1; z += 2.5) {
      m.line([b.x, b.y + b.d, z], [b.x + b.w, b.y + b.d, z], 1, mortar, 0.45, 0.01);
      m.line([b.x + b.w, b.y + b.d, z], [b.x + b.w, b.y, z], 1, mortar, 0.45, 0.01);
    }
    m.box({ x: b.x - 0.02, y: b.y - 0.02, w: b.w + 0.04, d: b.d + 0.04, z: b.z + b.h, h: 1.6 }, coping, { outline: false });
    const { c, a } = windowColor(p, b.x * 3);
    const z0 = b.z + b.h - 7.5;
    const z1 = b.z + b.h - 2;
    m.poly([[b.x + 0.12, b.y + b.d, z0], [b.x + b.w - 0.12, b.y + b.d, z0], [b.x + b.w - 0.12, b.y + b.d, z1], [b.x + 0.12, b.y + b.d, z1]], c, a, 0.02);
    for (let x = b.x + 0.12; x < b.x + b.w - 0.12; x += 0.11) m.line([x, b.y + b.d, z0], [x, b.y + b.d, z1], 1, mortar, 0.8, 0.03);
    m.poly([[b.x + b.w, b.y + b.d - 0.1, z0], [b.x + b.w, b.y + 0.1, z0], [b.x + b.w, b.y + 0.1, z1], [b.x + b.w, b.y + b.d - 0.1, z1]], c, a, 0.02);
    for (let y = b.y + 0.1; y < b.y + b.d - 0.1; y += 0.11) m.line([b.x + b.w, y, z0], [b.x + b.w, y, z1], 1, mortar, 0.8, 0.03);
  };
  tier(base);
  slab(base, 0.5, GROUND + 15.6);
  tier(main);
  slab(main, 0.55, GROUND + 30.6);
  tier(belvedere);
  slab(belvedere, 0.4, GROUND + 44);
  m.box({ x: main.x + 1.0, y: main.y + 0.22, w: 0.3, d: 0.34, z: GROUND + 16, h: 36 }, brick);
  m.box({ x: main.x + 0.98, y: main.y + 0.2, w: 0.34, d: 0.38, z: GROUND + 52, h: 1.5 }, coping, { outline: false });
  const wall = tb({ x: 16.8, y: 9.35, w: 2.9, d: 0.1, z: GROUND, h: 5 });
  m.box(wall, brick, { outline: false });
  for (const x of [16.85, 18.2, 19.55]) {
    const pier = tb({ x, y: 9.32, w: 0.16, d: 0.16, z: GROUND, h: 7 });
    m.box(pier, brick, { outline: false });
    m.box({ ...pier, z: GROUND + 7, h: 1.5, x: pier.x - 0.03, y: pier.y - 0.03, w: 0.22, d: 0.22 }, coping, { outline: false });
    m.dot([pier.x + 0.08, pier.y + 0.08, GROUND + 10.5], 2.2, p.leafLight, 1, 0.04);
  }
});

// --- Trees ------------------------------------------------------------------
trees("quad-trees", [
  [5.2, 8.1, 6],
  [8.6, 8.4, 6],
  [4.6, 11.8, 7],
  [9.4, 11.9, 6],
  [5.8, 9.8, 5],
  [8.4, 10.2, 5],
  [6.0, 12.4, 5],
  [8.9, 12.6, 6],
  [8.1, 9.0, 5],
]);
treeLine("midway-n", [0.6, 15.0], [GRID - 0.6, 15.0], 1.4, 6);
treeLine("midway-s", [1.3, 18.2], [GRID - 0.6, 18.2], 1.4, 6);
treeLine("south-park", [0.8, 20.4], [GRID - 0.8, 20.4], 1.6, 7);
treeLine("ellis", [1.85, 7.0], [1.85, 13.8], 1.7, 5);
treeLine("woodlawn", [15.8, 7.2], [15.8, 13.8], 1.6, 5);
treeLine("57th", [3.2, 5.7], [8.6, 5.7], 1.5, 5);
treeLine("rockefeller-lawn", [12.6, 13.6], [15.6, 13.6], 0.8, 5);
treeLine("mansueto-green", [17.9, 0.9], [20.8, 5.2], 1.1, 6);
treeLine("robie-green", [17.0, 7.3], [20.8, 7.3], 1.3, 5);
treeLine("field-edge", [0.6, 0.6], [0.6, 5.4], 1.3, 5);
trees("misc-trees", [
  [0.9, 7.4, 6],
  [0.9, 12.8, 6],
  [8.5, 1.0, 5],
  [8.6, 4.6, 5],
  [12.8, 7.0, 4],
  [15.3, 7.0, 4],
  [1.0, 16.5, 6],
  [20.0, 14.6, 5],
  [13.2, 5.2, 5],
  [12.2, 0.9, 5],
  [3.4, 3.6, 5],
  [20.6, 9.0, 5],
  [11.0, 19.6, 6],
  [16.5, 19.3, 6],
  [5.5, 19.8, 6],
]);

// --- Booth: the winter garden, a glass pavilion on four twisting columns ---
// Drawn last so what stands behind it shows through the glass.
add("booth", true, (m, p) => {
  const white = p.shades(hex("#f1f2ef"));
  const glass = p.shades(p.glass);
  const mullion = p.night ? mix(p.glass, hex("#ffffff"), 0.3) : mix(p.glass, hex("#1b3450"), 0.5);
  // The columns are bright white, so they need real shadow sides and dark
  // edges to read through the glass; night dims them to a warm grey.
  const columnBase = p.night ? hex("#c9ccd4") : hex("#ffffff");
  const column: Shades = {
    top: columnBase,
    left: mix(columnBase, hex("#5b6478"), p.night ? 0.3 : 0.22),
    right: mix(columnBase, hex("#2b3344"), p.night ? 0.55 : 0.45),
    edge: mix(columnBase, hex("#1b2436"), 0.7),
  };

  const wg = tb({ x: 16.9, y: 10.3, w: 3.4, d: 3.0, z: GROUND, h: 92 });
  const top = wg.z + wg.h;
  // The roof folds, seen from outside: lowest at the eaves, up to a low ridge
  // on each side, down into a valley over each column line, and up to the tall
  // spine in the middle. The creases between the ridges fold inward.
  const eave = top + 2.4;
  const zSide = eave + 8;
  const zValley = eave + 2;
  const zSpine = eave + 24;
  const yc = wg.y + wg.d / 2;
  const ySide = [wg.y + wg.d * 0.15, wg.y + wg.d * 0.85] as const;
  const yValley = [wg.y + wg.d * 0.3, wg.y + wg.d * 0.7] as const;
  // Plinth and floor slab
  m.box({ x: wg.x - 0.15, y: wg.y - 0.15, w: wg.w + 0.3, d: wg.d + 0.3, z: GROUND, h: 2.5 }, white);
  // The far walls, drawn first and very faint, so the pavilion reads as a volume behind the columns
  m.poly([[wg.x, wg.y, wg.z], [wg.x + wg.w, wg.y, wg.z], [wg.x + wg.w, wg.y, top], [wg.x, wg.y, top]], glass.left, 0.1, 0.08);
  m.poly([[wg.x, wg.y, wg.z], [wg.x, wg.y + wg.d, wg.z], [wg.x, wg.y + wg.d, top], [wg.x, wg.y, top]], glass.right, 0.1, 0.08);
  m.line([wg.x, wg.y, wg.z], [wg.x, wg.y, top], 1.2, white.right, 0.7, 0.09);

  // Four square columns that twist a quarter turn as they rise, then branch
  // like trees to carry the roof. Each slice is a short square prism rotated
  // a little more than the one below; the corner lines spiral up the shaft.
  const twist = (cx: number, cy: number) => {
    const shaftTop = zValley - 26;
    const step = 2;
    const r = 0.3;
    const ring = (zz: number, phase: number): P3[] =>
      Array.from({ length: 4 }, (_, i) => {
        const a = ((i + 0.5) / 4) * Math.PI * 2 + phase;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a), zz];
      });
    const phaseAt = (z: number) => (((z - GROUND) / (shaftTop - GROUND)) * Math.PI) / 2;
    for (let z = GROUND + 2; z < shaftTop; z += step) {
      const z1 = Math.min(z + step, shaftTop);
      const b = ring(z, phaseAt(z));
      const u = ring(z1, phaseAt(z1));
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        // Which way this face points, in camera space: toward the camera is lit
        const nx = (b[i][1] - b[j][1]);
        const ny = -(b[i][0] - b[j][0]);
        const facing = (nx + ny) / Math.hypot(nx, ny);
        if (facing < -0.15) continue; // back faces are hidden by the front ones
        const shade = facing > 0.75 ? column.top : facing > 0.25 ? column.left : column.right;
        m.poly([u[i], u[j], b[j], b[i]], shade, 1, 0.1);
      }
    }
    // Spiralling corner edges, drawn as one dark helix per corner
    for (let i = 0; i < 4; i++) {
      for (let z = GROUND + 2; z < shaftTop; z += step) {
        const z1 = Math.min(z + step, shaftTop);
        const a = ring(z, phaseAt(z))[i];
        const b = ring(z1, phaseAt(z1))[i];
        // Only the corners on the camera side of the shaft are visible
        if (a[0] - cx + (a[1] - cy) < -0.05) continue;
        m.line(a, b, 1.2, column.edge, 0.9, 0.12);
      }
    }
    // Capital where the shaft meets the ribs
    m.prism(cx, cy, r + 0.05, shaftTop - 1.5, 3, 4, column, Math.PI / 2);
    // Ribs, like the real ones: a trunk rises straight to just under the
    // valley over the column, then ribs peel off and run along the underside
    // of the glass to the folds: along the valley, up to the spine, out to the side ridge.
    const yEdge = cy < yc ? ySide[0] : ySide[1];
    const knee = zValley - 3;
    m.line([cx, cy, shaftTop], [cx, cy, knee], 3.2, column.edge, 1, 0.1);
    m.line([cx, cy, shaftTop], [cx, cy, knee], 1.6, column.top, 1, 0.11);
    const ends: P3[] = [
      [cx - 0.6, cy, zValley - 1.5],
      [cx + 0.6, cy, zValley - 1.5],
      [cx - 0.45, yc, zSpine - 1.5],
      [cx, yc, zSpine - 1.5],
      [cx + 0.45, yc, zSpine - 1.5],
      [cx - 0.45, yEdge, zSide - 1.5],
      [cx, yEdge, zSide - 1.5],
      [cx + 0.45, yEdge, zSide - 1.5],
    ];
    for (const end of ends) {
      const p0: P3 = [cx, cy, knee - 7];
      let prev = p0;
      for (let k = 1; k <= 5; k++) {
        const t = k / 5;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        const pt: P3 = [a * p0[0] + b * cx + c * end[0], a * p0[1] + b * cy + c * end[1], a * p0[2] + b * knee + c * end[2]];
        m.line(prev, pt, 2.2, column.edge, 1, 0.1);
        m.line(prev, pt, 0.9, column.top, 1, 0.11);
        prev = pt;
      }
    }
  };
  for (const [fx, fy] of [
    [0.27, 0.3],
    [0.73, 0.3],
    [0.27, 0.7],
    [0.73, 0.7],
  ] as const) {
    twist(wg.x + wg.w * fx, wg.y + wg.d * fy);
  }

  // Glass walls, nearly clear so the columns show, with sparse mullions and a white floor line
  const paneL = mix(glass.left, hex("#ffffff"), 0.35);
  m.poly([[wg.x, wg.y + wg.d, wg.z], [wg.x + wg.w, wg.y + wg.d, wg.z], [wg.x + wg.w, wg.y + wg.d, top], [wg.x, wg.y + wg.d, top]], paneL, 0.18, 0.12);
  m.poly([[wg.x + wg.w, wg.y + wg.d, wg.z], [wg.x + wg.w, wg.y, wg.z], [wg.x + wg.w, wg.y, top], [wg.x + wg.w, wg.y + wg.d, top]], glass.right, 0.22, 0.12);
  for (let x = wg.x + 0.25; x < wg.x + wg.w; x += 0.5) m.line([x, wg.y + wg.d, wg.z], [x, wg.y + wg.d, top], 1, mullion, 0.3, 0.13);
  for (let y = wg.y + 0.25; y < wg.y + wg.d; y += 0.5) m.line([wg.x + wg.w, y, wg.z], [wg.x + wg.w, y, top], 1, mullion, 0.3, 0.13);
  for (let z = wg.z + 22; z < top - 4; z += 22) {
    m.line([wg.x, wg.y + wg.d, z], [wg.x + wg.w, wg.y + wg.d, z], 1, white.top, 0.5, 0.13);
    m.line([wg.x + wg.w, wg.y + wg.d, z], [wg.x + wg.w, wg.y, z], 1, white.top, 0.5, 0.13);
  }
  for (const [x, y] of [
    [wg.x, wg.y + wg.d],
    [wg.x + wg.w, wg.y + wg.d],
    [wg.x + wg.w, wg.y],
  ] as const) {
    m.line([x, y, wg.z], [x, y, top], 1.6, white.right, 1, 0.14);
  }
  m.box({ x: wg.x - 0.04, y: wg.y - 0.04, w: wg.w + 0.08, d: wg.d + 0.08, z: top, h: 2.4 }, white, { outline: false });

  // The folded glass roof, clear enough to see the ribs through it. Its
  // section is a zigzag of three ridges: the surface climbs from each eave to
  // a low side ridge, folds inward into a valley, and climbs to the spine.
  // Facets go far-to-near so the ones behind show through the ones in front.
  const lit = mix(glass.top, hex("#ffffff"), 0.3);
  const shade = mix(glass.left, hex("#1b3450"), 0.15);
  const spine = p.night ? mix(hex("#dfe3ea"), p.glass, 0.3) : mix(hex("#f6f7f4"), hex("#1b3450"), 0.3);
  const x0 = wg.x;
  const x1 = wg.x + wg.w;
  const y0 = wg.y;
  const y1 = wg.y + wg.d;
  const profile: (readonly [number, number])[] = [
    [y0, eave],
    [ySide[0], zSide],
    [yValley[0], zValley],
    [yc, zSpine],
    [yValley[1], zValley],
    [ySide[1], zSide],
    [y1, eave],
  ];
  profile.forEach(([ya, za], i) => {
    if (i + 1 >= profile.length) return;
    const [yb, zb] = profile[i + 1];
    const bias = 0.2 + i * 0.01;
    // Facets that descend toward the camera catch the light; the ones climbing away are in shade
    const color = zb < za ? lit : shade;
    m.poly([[x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb]], color, zb < za ? 0.32 : 0.28, bias);
    for (let x = x0 + 0.5; x < x1 - 0.01; x += 0.5) m.line([x, ya, za], [x, yb, zb], 1, mullion, 0.3, bias + 0.005);
    const y = (ya + yb) / 2;
    const z = (za + zb) / 2;
    m.line([x0, y, z], [x1, y, z], 1, mullion, 0.3, bias + 0.005);
    // Vertical glass closes the zigzag at both ends
    for (const x of [x0, x1]) {
      m.poly([[x, ya, eave], [x, yb, eave], [x, yb, zb], [x, ya, za]], x === x1 ? shade : glass.right, x === x1 ? 0.34 : 0.26, bias + (x === x1 ? 0.06 : 0.002));
    }
  });
  // Steel along every fold: ridges and valleys along the roof, and the end profiles
  profile.forEach(([y, z], i) => {
    if (i === 0 || i + 1 === profile.length) return;
    const isSpine = i === 3;
    m.line([x0, y, z], [x1, y, z], isSpine ? 1.6 : 1.2, spine, isSpine ? 1 : 0.9, 0.27);
  });
  for (const x of [x0, x1]) {
    for (let i = 0; i + 1 < profile.length; i++) {
      m.line([x, profile[i][0], profile[i][1]], [x, profile[i + 1][0], profile[i + 1][1]], x === x1 ? 1.4 : 1, spine, x === x1 ? 1 : 0.7, 0.27);
    }
  }
});

export const PROPS: readonly Prop[] = props;

/** Everything that doesn't move. `riseAt(i)` is 0..1 per prop for the grow-in. */
export function buildStatic(m: Mesh, p: Palette, riseAt: (i: number) => number) {
  m.reset();
  const [sx, sy] = project(GRID / 2, GRID / 2, 0);
  const pts: Pt[] = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    pts.push([sx + 400 * Math.cos(t), sy + 24 + 170 * Math.sin(t)]);
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
// Sky: a faint downtown on the horizon, stars at night, drifting clouds
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

/** Downtown, as a big hazy pixel silhouette behind the block. */
interface Tower {
  x: number;
  w: number;
  h: number;
  kind?: "willis" | "hancock" | "trump" | "aon" | "marina" | "crain" | "wrigley" | "stregis" | "prudential" | "tribune";
}

const HORIZON = 210;
const SKYLINE: Tower[] = [
  { x: 10, w: 26, h: 44 },
  { x: 44, w: 34, h: 70 },
  { x: 86, w: 22, h: 96 },
  { x: 116, w: 40, h: 60 },
  { x: 160, w: 30, h: 122, kind: "prudential" },
  { x: 198, w: 36, h: 80 },
  { x: 240, w: 26, h: 104 },
  { x: 270, w: 34, h: 126, kind: "crain" },
  { x: 310, w: 68, h: 186, kind: "willis" },
  { x: 384, w: 28, h: 90 },
  { x: 418, w: 34, h: 150, kind: "aon" },
  { x: 458, w: 24, h: 76 },
  { x: 488, w: 38, h: 140, kind: "trump" },
  { x: 532, w: 22, h: 98 },
  { x: 558, w: 46, h: 92, kind: "marina" },
  { x: 610, w: 30, h: 128, kind: "stregis" },
  { x: 646, w: 24, h: 84 },
  { x: 676, w: 60, h: 172, kind: "hancock" },
  { x: 742, w: 30, h: 106, kind: "tribune" },
  { x: 778, w: 26, h: 88, kind: "wrigley" },
  { x: 810, w: 34, h: 60 },
  { x: 850, w: 24, h: 40 },
];

function skyline(m: Mesh, p: Palette, t: number) {
  const near = -140;
  // A wash of distant haze: everything at low alpha so campus stays the subject
  const A = p.night ? 0.42 : 0.26;
  const body = p.night ? hex("#1c2338") : hex("#9aa6bd");
  const side = p.night ? hex("#121828") : hex("#7e8aa3");
  const edge = p.night ? hex("#0a0e1a") : hex("#5f6a82");
  const lit = p.night ? hex("#ffd36a") : hex("#f4f7fb");
  const red = hex("#ff3b3b");
  const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB, a = A, bias = 0) =>
    m.polyScreen([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], near + bias, c, a);
  // Lake Michigan at the horizon
  rect(0, HORIZON, VIEW_W, HORIZON + 10, p.night ? hex("#0d1a2e") : hex("#9fc0dc"), A * 0.8, -2);

  for (const b of SKYLINE) {
    const x0 = b.x;
    const x1 = b.x + b.w;
    const top = HORIZON - b.h;
    const win = (xa: number, xb: number, ya: number, yb: number, stepX = 4, stepY = 5) => {
      for (let y = ya + 3; y < yb - 2; y += stepY) {
        for (let x = xa + 2; x < xb - 2; x += stepX) {
          if (hash(x * 3.1 + y * 7.7) > (p.night ? 0.5 : 0.45)) continue;
          rect(x, y, x + 1.6, y + 2, lit, A * (p.night ? 1.4 : 1.1), 0.02);
        }
      }
    };
    const shaft = (xa: number, xb: number, ya: number, yb: number, taperTop = 0) => {
      m.polyScreen([[xa + taperTop, ya], [xb - taperTop, ya], [xb, yb], [xa, yb]], near, body, A);
      m.polyScreen([[xb - taperTop, ya], [xb - taperTop + 4, ya + 2], [xb + 4, yb], [xb, yb]], near, side, A);
      rect(xa + taperTop, ya, xb - taperTop, ya + 1.2, edge, A, 0.01);
      win(xa, xb, ya, yb);
    };
    const antenna = (ax: number, ya: number, h: number) => {
      rect(ax - 0.7, ya - h, ax + 0.7, ya, side, A);
      if (p.night) {
        const blink = 0.3 + 0.7 * Math.abs(Math.sin(t * 2.2 + ax));
        rect(ax - 1.4, ya - h - 2, ax + 1.4, ya - h, red, blink * 0.9, 0.03);
      }
    };
    switch (b.kind) {
      case "willis": {
        // Nine bundled tubes in three tiers, two antennas
        const w3 = b.w / 3;
        shaft(x0, x0 + w3, HORIZON - b.h * 0.62, HORIZON);
        shaft(x0 + w3, x0 + 2 * w3, HORIZON - b.h, HORIZON);
        shaft(x0 + 2 * w3, x1, HORIZON - b.h * 0.82, HORIZON);
        shaft(x0 + w3 * 0.5, x0 + w3 * 1.5, HORIZON - b.h * 0.9, HORIZON - b.h * 0.62);
        for (let y = top + 6; y < HORIZON; y += 14) rect(x0 + w3, y, x0 + 2 * w3, y + 1, edge, A * 0.8, 0.015);
        antenna(x0 + w3 * 1.3, top, 40);
        antenna(x0 + w3 * 1.7, top, 34);
        break;
      }
      case "hancock": {
        shaft(x0, x1, top, HORIZON, 12);
        // X-bracing
        for (let y = top + 10; y < HORIZON - 10; y += 32) {
          const inset = 12 * (1 - (y - top) / b.h);
          m.polyScreen([[x0 + inset, y], [x0 + inset + 1.2, y], [x1 - inset, y + 30], [x1 - inset - 1.2, y + 30]], near + 0.02, edge, A);
          m.polyScreen([[x1 - inset, y], [x1 - inset - 1.2, y], [x0 + inset, y + 30], [x0 + inset + 1.2, y + 30]], near + 0.02, edge, A);
        }
        antenna(x0 + b.w * 0.3, top, 44);
        antenna(x0 + b.w * 0.7, top, 44);
        break;
      }
      case "trump": {
        shaft(x0, x1, HORIZON - b.h * 0.55, HORIZON);
        shaft(x0 + 6, x1 - 2, HORIZON - b.h * 0.8, HORIZON - b.h * 0.55);
        shaft(x0 + 12, x1 - 4, top, HORIZON - b.h * 0.8);
        m.polyScreen([[x0 + 18, top], [x0 + 22, top], [x0 + 20, top - 36]], near, side, A);
        break;
      }
      case "aon": {
        shaft(x0, x1, top, HORIZON);
        for (let x = x0 + 3; x < x1; x += 4) rect(x, top, x + 1, HORIZON, lit, A * 0.8, 0.012);
        break;
      }
      case "marina": {
        for (const cx of [x0 + b.w * 0.27, x0 + b.w * 0.73]) {
          const r = b.w * 0.22;
          const pts: Pt[] = [];
          for (let i = 0; i <= 8; i++) {
            const a = Math.PI + (i / 8) * Math.PI;
            pts.push([cx + r * Math.cos(a), top + r * 0.5 + r * 0.5 * Math.sin(a)]);
          }
          m.polyScreen([[cx - r, HORIZON], ...pts, [cx + r, HORIZON]], near, body, A);
          for (let y = top + r; y < HORIZON - 3; y += 5) rect(cx - r + 1, y, cx + r - 1, y + 1.2, edge, A * 0.9, 0.012);
        }
        break;
      }
      case "crain": {
        shaft(x0, x1, top, HORIZON);
        m.polyScreen([[x0, top], [x1, top], [x1, top - 22]], near, body, A);
        m.polyScreen([[x0, top], [x1, top - 22], [x1, top - 20], [x0, top + 2]], near + 0.01, edge, A);
        break;
      }
      case "stregis": {
        shaft(x0, x0 + b.w * 0.4, HORIZON - b.h * 0.7, HORIZON);
        shaft(x0 + b.w * 0.3, x0 + b.w * 0.72, top, HORIZON);
        shaft(x0 + b.w * 0.62, x1, HORIZON - b.h * 0.85, HORIZON);
        break;
      }
      case "prudential": {
        shaft(x0, x1, top, HORIZON);
        m.polyScreen([[x0 + b.w / 2 - 1.5, top], [x0 + b.w / 2 + 1.5, top], [x0 + b.w / 2, top - 30]], near, side, A);
        break;
      }
      case "tribune": {
        shaft(x0, x1, top, HORIZON);
        // Flying-buttress crown
        for (const dx of [2, 8, b.w - 10, b.w - 4]) rect(x0 + dx, top - 14, x0 + dx + 2, top, side, A);
        rect(x0 + 6, top - 20, x1 - 6, top, body, A);
        break;
      }
      case "wrigley": {
        shaft(x0, x1, top, HORIZON);
        rect(x0 + 8, top - 24, x1 - 8, top, body, A);
        rect(x0 + 10, top - 18, x1 - 10, top - 14, lit, A, 0.02);
        m.polyScreen([[x0 + 8, top - 24], [x1 - 8, top - 24], [x0 + b.w / 2, top - 34]], near, side, A);
        break;
      }
      default:
        shaft(x0, x1, top, HORIZON);
    }
  }
}

export function buildSky(m: Mesh, p: Palette, t: number) {
  m.reset();
  skyline(m, p, t);
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
// Vehicles and students
// ---------------------------------------------------------------------------

export interface VehicleSpec {
  id: string;
  /** Closed loop in camera coordinates. */
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
  /** A window band around the body (buses). */
  band?: RGB;
  /** A smaller cabin on top (cars). */
  cabin?: boolean;
}

/** A closed loop given in campus coordinates. */
const loop = (...pts: Pt[]): Pt[] => pts.map(tpt);

const S57 = 6 + STREET_W / 2;
const S59 = 14 + STREET_W / 2;
const ELLIS = 2 + STREET_W / 2;
const UNIV = 11.5 + STREET_W / 2;
const WOOD = 15.9 + STREET_W / 2;

export const VEHICLES: readonly VehicleSpec[] = [
  { id: "bus55", path: loop([0.3, S57 - 0.16], [EAST_EDGE - 0.3, S57 - 0.16], [EAST_EDGE - 0.3, S57 + 0.16], [0.3, S57 + 0.16]), speed: 1.8, offset: 6, z: GROUND, len: 1.0, wid: 0.36, h: 12, color: hex("#f3f4f6"), band: hex("#2b5fd9") },
  { id: "ugo", path: loop([UNIV - 0.15, S57], [UNIV - 0.15, S59], [WOOD + 0.15, S59], [WOOD + 0.15, S57]), speed: 1.5, offset: 14, z: GROUND, len: 0.7, wid: 0.34, h: 10, color: hex("#7a1d2b"), band: hex("#2a2a30") },
  { id: "taxi", path: loop([0.3, S59 - 0.16], [EAST_EDGE - 0.3, S59 - 0.16], [EAST_EDGE - 0.3, S59 + 0.16], [0.3, S59 + 0.16]), speed: 2.3, offset: 30, z: GROUND, len: 0.5, wid: 0.3, h: 6, color: hex("#f2c230"), cabin: true },
  { id: "car-ellis", path: loop([ELLIS - 0.15, 0.3], [ELLIS - 0.15, 14.4], [ELLIS + 0.15, 14.4], [ELLIS + 0.15, 0.3]), speed: 2.0, offset: 9, z: GROUND, len: 0.5, wid: 0.3, h: 6, color: hex("#d7262b"), cabin: true },
];

function pathLengths(path: readonly Pt[]): number[] {
  return path.map((a, i) => {
    const b = path[(i + 1) % path.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
}

const LENGTHS = new Map(VEHICLES.map((v) => [v.id, pathLengths(v.path)]));

/** A point along a closed polyline, `dist` tiles from its start. */
function pointAt(path: readonly Pt[], lens: number[], dist: number): { x: number; y: number; alongX: boolean } {
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
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, alongX: Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) };
}

/** Where a vehicle is after `t` seconds: an oriented box on its path. */
export function poseAt(v: VehicleSpec, t: number): BoxSpec {
  const { x, y, alongX } = pointAt(v.path, LENGTHS.get(v.id)!, v.offset + v.speed * t);
  const w = alongX ? v.len : v.wid;
  const d = alongX ? v.wid : v.len;
  return { x: x - w / 2, y: y - d / 2, w, d, z: v.z, h: v.h };
}

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
    loop([7.1, 6.9], [7.1, 13.8]),
    loop([7.04, 13.8], [7.04, 6.9]),
    loop([2.9, 10.5], [11.3, 10.5]),
    loop([11.3, 10.56], [2.9, 10.56]),
    loop([3.4, 7.3], [7.1, 10.5], [10.8, 13.7]),
    loop([10.8, 7.3], [7.1, 10.5], [3.4, 13.7]),
    loop([3.4, 13.7], [7.1, 10.5]),
    loop([10.8, 7.3], [7.1, 10.5]),
    loop([0.5, 16.6], [GRID - 0.5, 16.6]),
    loop([GRID - 0.5, 16.7], [0.5, 16.7]),
    loop([15.1, 6.0], [15.1, 5.0]),
    loop([9.0, 0.7], [9.0, 5.8]),
    loop([12.6, 13.9], [14.4, 10.9]),
    loop([UNIV + 0.45, 7], [UNIV + 0.45, 13.8]),
    loop([WOOD - 0.45, 13.8], [WOOD - 0.45, 7]),
    loop([3.0, 5.8], [11.4, 5.8]),
  ];
  const out: Walker[] = [];
  for (const route of routes) {
    const n = 1 + Math.floor(rand() * 2.5);
    for (let i = 0; i < n; i++) {
      out.push({
        path: route,
        lens: pathLengths(route),
        speed: 0.4 + rand() * 0.3,
        offset: rand() * 30,
        shirt: SHIRTS[Math.floor(rand() * SHIRTS.length)],
        skin: SKIN[Math.floor(rand() * SKIN.length)],
      });
    }
  }
  return out;
})();

function buildWalkers(m: Mesh, p: Palette, t: number) {
  for (const w of WALKERS) {
    const { x, y } = pointAt(w.path, w.lens, w.offset + w.speed * t);
    const bob = Math.abs(Math.sin((t * w.speed * 9) % Math.PI)) * 0.5;
    const shirt = p.night ? mix(w.shirt, hex("#0a0e1a"), 0.45) : w.shirt;
    const head = p.night ? mix(w.skin, hex("#0a0e1a"), 0.4) : w.skin;
    m.dot([x, y, GROUND + 1.8 + bob], 2.4, shirt, 1, 0.08);
    m.dot([x, y, GROUND + 5.0 + bob], 1.7, head, 1, 0.09);
    m.dot([x, y, GROUND + 0.4 + bob * 0.5], 1.5, mix(shirt, hex("#000000"), 0.6), 1, 0.08);
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
          h: 4.5,
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
  // Bubbles sit in the empty corners around the block, so only buildings on
  // its edges get them; the quad and Saieh stay uncovered.
  { id: "mansueto", label: "Mansueto", x: 15.2, y: 3.0, z: 50, keywords: ["mansueto"], primary: true },
  { id: "reg", label: "The Reg", x: 11.2, y: 2.6, z: 96, keywords: ["the reg", "reg hit", "regenstein", "reg ", "min sok lee", "midterm", "econ", "pset", "problem set", "finals", "reading period"], primary: true },
  { id: "ratner", label: "Ratner", x: 5.4, y: 1.6, z: 120, keywords: ["ratner", "squat", "gym", "lap swim", "maroons", "football", "track meet", "intramural"], primary: true },
  { id: "robie", label: "Robie House", x: 18.25, y: 8.75, z: 62, keywords: ["robie", "wright", "doc films", "screening", "the pub", "pub ", "trivia", "pretzel"] },
  { id: "booth", label: "Booth", x: 18.6, y: 11.8, z: 130, keywords: ["booth", "atrium", "mba", "harper center", "bitcoin", "crypto", "eth"] },
  { id: "cobb", label: "Cobb Hall", x: 3.55, y: 10.9, z: 100, keywords: ["cobb", "sosc", "the core", "quad", "scav", "campus", "hull gate", "botany", "pond"] },
  { id: "midway", label: "The Midway", x: 19.0, y: 16.6, z: 18, keywords: ["rink", "midway", "skating", "sled"] },
  { id: "sky", label: "Hyde Park sky", x: 2.0, y: 16.6, z: 70, keywords: ["rain", "snow", "frost", "weather", "°f", "wind", "sunny"] },
];

/** Where a market with no keyword match goes, by category. */
export const CATEGORY_ANCHOR: Record<string, string> = {
  sports: "ratner",
  campus: "reg",
  news: "sky",
  culture: "robie",
  crypto: "booth",
  other: "cobb",
};

export { VIEW_H, VIEW_W };
