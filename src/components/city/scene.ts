// The University of Chicago's landmarks as pixel-art geometry: a dozen
// buildings a student would recognize, arranged on a compact block, not a
// survey of Hyde Park. Campus coordinates run x east, y south on a 22×22 grid.
//
// The camera looks from the north-east, so Mansueto's dome and the Reg sit in
// front, Saieh's tower in the center, the quad and Rockefeller behind, and
// Logan, B-J and the Law School on the far skyline.
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
const GLASS = hex("#8fb8dc");
const WHITE = hex("#eef0eb");
const CONCRETE = hex("#d6d0c0");
const CHIMNEY = hex("#9c8a6e");
const TIMBER = hex("#4a3426");
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

/** Dark timber framing on the upper walls (Tudor). */
function halfTimber(m: Mesh, b: BoxSpec, p: Palette) {
  const c = p.night ? mix(TIMBER, hex("#05070f"), 0.5) : TIMBER;
  const top = b.z + b.h;
  const z0 = b.z + b.h * 0.55;
  const yL = b.y + b.d;
  m.line([b.x, yL, z0], [b.x + b.w, yL, z0], 1, c, 1, 0.025);
  for (let x = b.x + 0.1; x < b.x + b.w; x += 0.2) m.line([x, yL, z0], [x, yL, top - 1], 1, c, 1, 0.025);
  const xR = b.x + b.w;
  m.line([xR, yL, z0], [xR, b.y, z0], 1, c, 1, 0.025);
  for (let y = b.y + 0.1; y < yL; y += 0.2) m.line([xR, y, z0], [xR, y, top - 1], 1, c, 1, 0.025);
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
// 57th, 59th, 60th; Ellis, University (south of 57th), Woodlawn (south of 57th)
const ROWS = [6, 14, 18.5];
const EAST_EDGE = 20.3;

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
  park(0, 14.7, EAST_EDGE, 18.5); // the Midway
  park(12.2, 10.6, 15.9, 14, 0.85); // Rockefeller's lawn
  park(12.2, 6.7, 15.9, 7.3, 0.8);
  park(16.6, 9.4, 20.3, 10.4, 0.8); // Robie's garden
  park(0, 0, 9.3, 5.8, 0.7); // north-west green by Ratner
  park(0, 6.7, 2, 14, 0.8);
  park(17.2, 0.3, 20.3, 5.8, 0.75); // east green by Mansueto
  park(0, 19.2, EAST_EDGE, GRID, 0.8);

  const rand = seeded(11);
  const tuft = mix(p.park, p.leafEdge, 0.35);
  for (const [x0, y0, x1, y1] of [
    [3.0, 7.0, 11.2, 13.7],
    [0.2, 14.9, EAST_EDGE - 0.2, 18.3],
    [12.4, 10.8, 15.7, 13.8],
    [17.4, 0.5, 20.1, 5.6],
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
  // Mansueto's forecourt and the path along the Midway
  path(m, p, [15.1, 5.0], [15.1, 6.0], 0.3);
  path(m, p, [0.3, 16.6], [EAST_EDGE - 0.3, 16.6], 0.16);
  path(m, p, [12.6, 13.9], [14.4, 10.9], 0.14);

  // Streets with center dashes
  const streets: [number, number, number, number][] = [
    ...ROWS.map((y): [number, number, number, number] => [0, y, EAST_EDGE, y + STREET_W]),
    [2.0, 0, 2.0 + STREET_W, GRID],
    [11.5, 6, 11.5 + STREET_W, GRID],
    [15.9, 6, 15.9 + STREET_W, GRID],
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

  // The Law School pool and fountain
  m.ellipse(...T(12.0, 19.6), 1.3, 0.3, GROUND + 0.07, p.waterRim);
  m.ellipse(...T(12.0, 19.6), 1.16, 0.22, GROUND + 0.09, p.water);
  m.dot(tp([12.0, 19.6, GROUND + 6]), 2, p.fountain);
  m.dot(tp([11.9, 19.6, GROUND + 3.5]), 1.2, p.fountain);
  m.dot(tp([12.1, 19.6, GROUND + 3.5]), 1.2, p.fountain);

  // The Midway rink
  m.ellipse(...T(9.5, 16.6), 1.35, 0.6, GROUND + 0.07, mix(p.rink, p.land, 0.4));
  m.ellipse(...T(9.5, 16.6), 1.2, 0.5, GROUND + 0.09, p.rink);

  // The Metra embankment along the east edge, with the 59th Street shelter
  const bermTop = GROUND + 16;
  m.box(tb({ x: 20.4, y: 0, w: 1.1, d: GRID, z: GROUND, h: 16 }), p.shades(p.berm));
  for (let y = 0.3; y < GRID; y += 0.45) m.line(tp([20.55, y, bermTop + 0.1]), tp([21.35, y, bermTop + 0.1]), 1, p.tie, 0.8, 0.02);
  for (const x of [20.72, 21.18]) m.line(tp([x, 0, bermTop + 0.2]), tp([x, GRID, bermTop + 0.2]), 1, p.rail, 1, 0.03);
  m.box(tb({ x: 20.5, y: 13.9, w: 0.3, d: 1.0, z: bermTop, h: 10 }), p.shades(hex("#7f1d1d")));
});

// ---------------------------------------------------------------------------
// The landmarks
// ---------------------------------------------------------------------------

// --- Foreground: Mansueto's dome, the Reg, Max P -------------------------

add("mansueto", true, (m, p) => {
  // An elliptical dome, long axis running north-south toward the viewer.
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
  // Concrete base ring and the reading-room link to the Reg
  m.ellipse(cx, cy, rx + 0.12, ry + 0.12, GROUND + 0.04, p.waterRim, 1, 0, 28);
  m.box({ x: cx - rx - 0.75, y: cy - 0.35, w: 0.8, d: 0.7, z: GROUND, h: 12 }, p.shades(CONCRETE));
});

add("reg", true, (m, p) => {
  const b = tb({ x: 9.6, y: 1.4, w: 3.9, d: 2.9, z: GROUND, h: 70 });
  const s = p.shades(hex("#d9d2c0"));
  m.box(b, s);
  windows(m, b, "slits", p);
  // Brutalist fins between the slits, and a heavy cornice
  const fin = p.shades(hex("#c9c2b0"));
  for (let x = b.x + 0.2; x < b.x + b.w - 0.1; x += 0.42) m.box({ x, y: b.y + b.d, w: 0.08, d: 0.07, z: GROUND, h: 66 }, fin, { outline: false });
  for (let y = b.y + 0.2; y < b.y + b.d - 0.1; y += 0.42) m.box({ x: b.x + b.w, y, w: 0.07, d: 0.08, z: GROUND, h: 66 }, fin, { outline: false });
  m.box({ x: b.x - 0.05, y: b.y - 0.05, w: b.w + 0.1, d: b.d + 0.1, z: GROUND + 70, h: 5 }, s);
  // Recessed entrance
  door(m, b, s, 0.5, 9);
});

for (const [i, c] of ["#d9661f", "#b6433b", "#6e4a8e"].entries()) {
  add(`maxp-${i}`, true, (m, p) => {
    const b = tb({ x: 9.6 + i * 1.33, y: 0.25, w: 1.2, d: 0.9, z: GROUND, h: 46 });
    m.box(b, p.shades(hex(c)));
    windows(m, b, "grid", p);
    // Saw-tooth roof
    m.gable({ ...b, w: b.w / 2 }, 6, "x", p.roofShades(mix(hex(c), hex("#000000"), 0.2)));
    m.gable({ ...b, x: b.x + b.w / 2, w: b.w / 2 }, 6, "x", p.roofShades(mix(hex(c), hex("#000000"), 0.2)));
  });
}

// --- Ratner, far north-west ---------------------------------------------
add("ratner", true, (m, p) => {
  const b = tb({ x: 3.2, y: 0.6, w: 4.6, d: 2.4, z: GROUND, h: 34 });
  m.box(b, p.shades(hex("#e0e4e5")));
  windows(m, b, "slits", p);
  const cable = mix(p.shades(WHITE).right, p.land, 0.3);
  for (const x of [4.2, 5.5, 6.8]) {
    const top = tp([x, 1.8, GROUND + 100]);
    m.line(tp([x - 0.9, 0.6, GROUND + 34]), top, 1, cable, 0.9);
    m.line(tp([x + 0.9, 3.0, GROUND + 34]), top, 1, cable, 0.9);
    m.line(tp([x, 1.8, GROUND + 34]), top, 2.2, p.shades(WHITE).top);
  }
});

// --- The main quad ---------------------------------------------------------

// North range: Hull Court (ivy, by the pond), Hutchinson Commons, Reynolds Club and Mitchell Tower
gothic("hull", { x: 4.6, y: 6.9, w: 2.4, d: 1.0, h: 48 }, "x", 16, { ivy: "heavy", turrets: ["D"], chimney: false });
gothic("hutch", { x: 7.3, y: 6.9, w: 1.8, d: 1.25, h: 56 }, "x", 28, { door: false, dormers: false, tallWindows: true, cappedButtresses: true });
gothic("reynolds", { x: 9.3, y: 6.9, w: 1.3, d: 1.0, h: 50 }, "x", 16, { dormers: false, ivy: true });
tower("mitchell", { x: 10.4, y: 6.9, w: 1.0, d: 1.0, h: 150 }, { pinnacles: 20, midPinnacles: true });

// Hull Gate: the arched entrance to the quad from 57th, between two piers
add("hull-gate", true, (m, p) => {
  const s = p.shades(LIMESTONE_DARK);
  const gate = tb({ x: 6.8, y: 6.8, w: 0.6, d: 0.22, z: GROUND, h: 24 });
  m.box(gate, s);
  door(m, gate, s, 0.26, 14);
  merlons(m, gate, s);
  for (const x of [6.72, 7.32]) m.box(tb({ x, y: 6.76, w: 0.16, d: 0.3, z: GROUND, h: 30 }), s, { inset: 0.02 });
});

// Lamp posts along the quad paths and the Midway
add("lamps", true, (m, p) => {
  const pole = p.shades(hex("#3b4150")).left;
  const lamp = p.night ? hex("#ffe9a8") : hex("#fff6d8");
  const spots: Pt[] = [];
  for (let y = 7.6; y < 13.6; y += 1.5) spots.push([7.3, y]);
  for (let x = 3.6; x < 11.2; x += 1.5) spots.push([x, 10.75]);
  for (let x = 1.0; x < EAST_EDGE; x += 2.0) spots.push([x, 16.85]);
  for (const [x, y] of spots) {
    m.line(tp([x, y, GROUND]), tp([x, y, GROUND + 11]), 1, pole);
    m.dot(tp([x, y, GROUND + 12]), 1.8, lamp, 1, 0.05);
  }
});

// A flagpole with a maroon flag by Hutch
add("flag", true, (m, p) => {
  const [x, y] = T(8.6, 8.55);
  m.line([x, y, GROUND], [x, y, GROUND + 52], 1.2, p.shades(hex("#d9dde6")).left);
  m.poly([[x, y, GROUND + 52], [x + 0.42, y, GROUND + 49], [x + 0.42, y, GROUND + 43], [x, y, GROUND + 46]], hex("#7a1d2b"), 1, 0.05);
});

// West range: Cobb Hall, the oldest building, with its gabled center bay
gothic("cobb", { x: 2.9, y: 8.3, w: 1.0, d: 5.2, h: 56 }, "y", 16, { ivy: "heavy", turrets: ["D", "C"], chimney: false });
gothic("cobb-bay", { x: 3.0, y: 10.3, w: 1.15, d: 1.2, h: 72 }, "x", 18, { door: false, dormers: false, buttress: false, chimney: false });

// East range: Classics with its corner turret, and Bond Chapel's little steeple
gothic("classics", { x: 10.3, y: 8.3, w: 1.05, d: 3.3, h: 54 }, "y", 15, { ivy: true, turrets: ["B"], chimney: false });
gothic("bond", { x: 10.2, y: 11.9, w: 1.1, d: 1.4, h: 44 }, "y", 20, { door: false, dormers: false, tallWindows: true, cappedButtresses: true, chimney: false });
tower("bond-steeple", { x: 10.45, y: 12.2, w: 0.45, d: 0.45, h: 70 }, { pinnacles: 0, crenellated: false, belfry: false, spire: 22 });

// South range: Harper Memorial Library with its twin towers and reading-room windows
gothic("harper", { x: 4.2, y: 12.5, w: 5.8, d: 1.4, h: 64 }, "x", 20, { tallWindows: true, cappedButtresses: true, ivy: true });
tower("harper-w", { x: 3.0, y: 12.4, w: 1.25, d: 1.5, h: 128 }, { pinnacles: 18 });
tower("harper-e", { x: 10.1, y: 12.4, w: 1.25, d: 1.5, h: 128 }, { pinnacles: 18 });

// --- Saieh Hall: the old seminary's tower and cloister ---------------------
gothic("saieh-main", { x: 12.4, y: 7.5, w: 3.3, d: 1.1, h: 52 }, "x", 17, { ivy: true, cappedButtresses: true });
gothic("saieh-wing", { x: 14.6, y: 8.6, w: 1.1, d: 1.6, h: 48 }, "y", 15, { door: false, dormers: false });
tower("saieh-tower", { x: 12.4, y: 8.6, w: 1.1, d: 1.1, h: 140 }, { color: LIMESTONE_DARK, pinnacles: 14, spire: 26 });
add("saieh-cloister", true, (m, p) => {
  // A low arcade around a courtyard garden
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

gothic("oriental-institute", { x: 12.5, y: 10.75, w: 3.0, d: 0.72, h: 40 }, "x", 14, { color: LIMESTONE_DARK, roof: SLATE, dormers: false, chimney: false, cappedButtresses: true });

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
  // Transept crossing the nave, with the rose window on its near end
  const transept = tb({ x: 13.9, y: 11.2, w: 1.2, d: 2.15, z: GROUND, h: 86 });
  m.box(transept, s);
  courses(m, transept, s, 5);
  buttresses(m, transept, s, true, 0.5);
  m.gable(transept, 34, "y", roof);
  roseWindow(m, transept, GROUND + 58, 13, s, p);
  door(m, transept, s, 0.22, 12);
  // Finials at the gable ends
  for (const pt of [tp([12.5, 12.27, GROUND + 120]), tp([14.9, 12.27, GROUND + 120]), tp([14.5, 11.2, GROUND + 120])]) {
    m.line(pt, [pt[0], pt[1], pt[2] + 7], 1.2, s.top);
  }
  // The tower at the east end
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

// --- East side: Bartlett, Robie House, Booth, Ida Noyes ---------------------
gothic("bartlett", { x: 17.6, y: 3.4, w: 2.5, d: 1.5, h: 56 }, "x", 24, { tallWindows: true, cappedButtresses: true, turrets: ["C"], ivy: true });

add("robie", true, (m, p) => {
  // Prairie style: long low brick, limestone coping, three tiers of cantilevered roof, one great chimney.
  const brick = p.shades(BRICK);
  const mortar = mix(BRICK, hex("#ffffff"), 0.45);
  const coping = p.shades(hex("#d9d2bd"));
  const eave = p.shades(hex("#6a4b3c"));
  const base = tb({ x: 16.9, y: 9.45, w: 2.7, d: 0.95, z: GROUND, h: 14 });
  const main = tb({ x: 17.0, y: 9.5, w: 2.5, d: 0.85, z: GROUND + 16, h: 13 });
  const belvedere = tb({ x: 17.6, y: 9.62, w: 1.2, d: 0.55, z: GROUND + 31.5, h: 11 });
  const slab = (b: BoxSpec, over: number, z: number) =>
    m.box({ x: b.x - over, y: b.y - over * 0.55, w: b.w + over * 2, d: b.d + over * 1.1, z, h: 2.2 }, eave, { outline: true });
  const tier = (b: BoxSpec, windowed: boolean) => {
    m.box(b, brick);
    for (let z = b.z + 2.5; z < b.z + b.h - 1; z += 2.5) {
      m.line([b.x, b.y + b.d, z], [b.x + b.w, b.y + b.d, z], 1, mortar, 0.45, 0.01);
      m.line([b.x + b.w, b.y + b.d, z], [b.x + b.w, b.y, z], 1, mortar, 0.45, 0.01);
    }
    // Limestone coping along the top of the wall
    m.box({ x: b.x - 0.02, y: b.y - 0.02, w: b.w + 0.04, d: b.d + 0.04, z: b.z + b.h, h: 1.6 }, coping, { outline: false });
    if (!windowed) return;
    const { c, a } = windowColor(p, b.x * 3);
    const z0 = b.z + b.h - 7.5;
    const z1 = b.z + b.h - 2;
    m.poly([[b.x + 0.12, b.y + b.d, z0], [b.x + b.w - 0.12, b.y + b.d, z0], [b.x + b.w - 0.12, b.y + b.d, z1], [b.x + 0.12, b.y + b.d, z1]], c, a, 0.02);
    for (let x = b.x + 0.12; x < b.x + b.w - 0.12; x += 0.11) m.line([x, b.y + b.d, z0], [x, b.y + b.d, z1], 1, mortar, 0.8, 0.03);
    m.poly([[b.x + b.w, b.y + b.d - 0.1, z0], [b.x + b.w, b.y + 0.1, z0], [b.x + b.w, b.y + 0.1, z1], [b.x + b.w, b.y + b.d - 0.1, z1]], c, a, 0.02);
    for (let y = b.y + 0.1; y < b.y + b.d - 0.1; y += 0.11) m.line([b.x + b.w, y, z0], [b.x + b.w, y, z1], 1, mortar, 0.8, 0.03);
  };
  tier(base, true);
  slab(base, 0.5, GROUND + 15.6);
  tier(main, true);
  slab(main, 0.55, GROUND + 30.6);
  tier(belvedere, true);
  slab(belvedere, 0.4, GROUND + 44);
  // The chimney, and the garden wall with its planters
  m.box({ x: main.x + 1.0, y: main.y + 0.22, w: 0.3, d: 0.34, z: GROUND + 16, h: 36 }, brick);
  m.box({ x: main.x + 0.98, y: main.y + 0.2, w: 0.34, d: 0.38, z: GROUND + 52, h: 1.5 }, coping, { outline: false });
  const wall = tb({ x: 16.8, y: 10.5, w: 2.9, d: 0.1, z: GROUND, h: 5 });
  m.box(wall, brick, { outline: false });
  for (const x of [16.85, 18.2, 19.55]) {
    const pier = tb({ x, y: 10.47, w: 0.16, d: 0.16, z: GROUND, h: 7 });
    m.box(pier, brick, { outline: false });
    m.box({ ...pier, z: GROUND + 7, h: 1.5, x: pier.x - 0.03, y: pier.y - 0.03, w: 0.22, d: 0.22 }, coping, { outline: false });
    m.dot([pier.x + 0.08, pier.y + 0.08, GROUND + 10.5], 2.2, p.leafLight, 1, 0.04);
  }
});

add("booth", true, (m, p) => {
  const g = p.shades(GLASS);
  const b = tb({ x: 16.9, y: 11.0, w: 3.1, d: 2.0, z: GROUND, h: 52 });
  m.box(b, g);
  windows(m, b, "grid", p);
  const atrium = tb({ x: 17.6, y: 11.6, w: 1.5, d: 1.0, z: GROUND + 52, h: 26 });
  m.box(atrium, g);
  windows(m, atrium, "grid", p);
  // The white "cloud" roof floating on thin posts
  const post = p.shades(hex("#c9d1d8")).left;
  for (const [x, y] of [
    [17.0, 11.1],
    [19.9, 11.1],
    [19.9, 12.9],
    [17.0, 12.9],
  ] as const) {
    m.line(tp([x, y, GROUND + 78]), tp([x, y, GROUND + 86]), 1, post);
  }
  m.box(tb({ x: 16.7, y: 10.8, w: 3.5, d: 2.4, z: GROUND + 86, h: 4 }), p.shades(hex("#f4f5f2")));
});

add("ida-noyes", true, (m, p) => {
  const brick = p.shades(hex("#a35b45"));
  const roof = p.roofShades(TILE_ROOF);
  const b = tb({ x: 16.9, y: 13.0, w: 3.0, d: 1.0, z: GROUND, h: 40 });
  m.box(b, brick);
  windows(m, b, "gothic", p);
  halfTimber(m, b, p);
  door(m, b, brick, 0.2, 9);
  m.gable(b, 18, "x", roof, TILE_ROWS);
  dormers(m, b, "x", 18, brick, roof, p);
  chimney(m, b, "x", 18, p, 0.8);
  const tw = tb({ x: 19.1, y: 13.0, w: 0.8, d: 0.8, z: GROUND, h: 72 });
  m.box(tw, brick);
  windows(m, tw, "gothic", p);
  merlons(m, tw, brick);
});

// --- The far skyline: Logan, Burton-Judson, the Law School -----------------
add("logan", true, (m, p) => {
  const s = p.shades(CONCRETE);
  const tw = tb({ x: 1.0, y: 19.3, w: 1.5, d: 1.6, z: GROUND, h: 150 });
  m.box(tw, s);
  windows(m, tw, "slits", p);
  const wing = tb({ x: 2.6, y: 19.3, w: 1.6, d: 1.6, z: GROUND, h: 28 });
  m.box(wing, s);
  windows(m, wing, "grid", p);
});
gothic("burton-judson", { x: 4.8, y: 19.3, w: 4.6, d: 1.5, h: 50 }, "x", 16, { turrets: ["D", "C"], ivy: true });
tower("bj-tower", { x: 6.9, y: 19.3, w: 0.8, d: 0.8, h: 88 }, { pinnacles: 12 });
add("law", true, (m, p) => {
  const b = tb({ x: 10.7, y: 20.0, w: 2.7, d: 1.0, z: GROUND, h: 72 });
  m.box(b, p.shades(hex("#9fc2dd")));
  windows(m, b, "slits", p);
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
treeLine("midway-n", [0.6, 15.0], [EAST_EDGE - 0.6, 15.0], 1.4, 6);
treeLine("midway-s", [1.3, 18.2], [EAST_EDGE - 0.6, 18.2], 1.4, 6);
treeLine("ellis", [1.85, 7.0], [1.85, 13.8], 1.7, 5);
treeLine("woodlawn", [15.8, 7.2], [15.8, 13.8], 1.6, 5);
treeLine("57th", [3.2, 5.7], [9.0, 5.7], 1.5, 5);
treeLine("rockefeller-lawn", [12.6, 13.6], [15.6, 13.6], 0.8, 5);
treeLine("mansueto-green", [17.8, 0.9], [19.9, 2.6], 1.0, 6);
trees("bartlett-trees", [
  [17.2, 5.4, 5],
  [19.3, 5.5, 5],
]);
treeLine("park-e", [21.8, 0.6], [21.8, 21.4], 1.3, 6);
trees("misc-trees", [
  [0.9, 7.4, 6],
  [0.9, 12.8, 6],
  [8.4, 1.5, 5],
  [8.6, 4.4, 5],
  [18.3, 8.9, 5],
  [16.3, 9.0, 5],
  [12.8, 7.0, 4],
  [15.3, 7.0, 4],
  [1.0, 16.5, 6],
  [4.0, 21.2, 6],
  [14.8, 21.0, 6],
  [18.5, 20.5, 6],
  [20.0, 14.5, 5],
  [13.2, 5.2, 5],
  [12.2, 1.0, 5],
]);

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

/** Distant downtown, as a hazy pixel silhouette along the horizon behind the block. */
interface Tower {
  x: number;
  w: number;
  h: number;
  /** top width for tapered towers */
  tw?: number;
  antennas?: number[];
  spire?: number;
  round?: boolean;
  light?: boolean;
}

const HORIZON = 206;
const SKYLINE: Tower[] = [
  { x: 60, w: 18, h: 30 },
  { x: 84, w: 22, h: 46 },
  { x: 112, w: 14, h: 58 },
  { x: 136, w: 26, h: 40 },
  { x: 176, w: 20, h: 72, spire: 18 }, // Prudential
  { x: 204, w: 24, h: 52 },
  { x: 236, w: 16, h: 64 },
  { x: 262, w: 22, h: 78 }, // Crain, diamond top
  { x: 296, w: 44, h: 150, antennas: [0.3, 0.72] }, // Willis
  { x: 350, w: 18, h: 60 },
  { x: 376, w: 22, h: 112 }, // Aon
  { x: 406, w: 16, h: 48 },
  { x: 428, w: 24, h: 104, spire: 30 }, // Trump
  { x: 460, w: 14, h: 66 },
  { x: 480, w: 30, h: 62, round: true }, // Marina City
  { x: 520, w: 20, h: 90, tw: 14 }, // St. Regis
  { x: 548, w: 16, h: 50 },
  { x: 572, w: 40, h: 132, tw: 26, antennas: [0.25, 0.75], light: true }, // Hancock
  { x: 622, w: 20, h: 70 },
  { x: 650, w: 24, h: 56 },
  { x: 682, w: 16, h: 44 },
  { x: 706, w: 26, h: 36 },
  { x: 742, w: 18, h: 52 },
  { x: 768, w: 22, h: 30 },
];

function skyline(m: Mesh, p: Palette, t: number) {
  const near = -140;
  const body = p.night ? hex("#171d30") : hex("#c3cad9");
  const side = p.night ? hex("#0f1424") : hex("#aeb7c8");
  const edge = p.night ? hex("#0a0e1a") : hex("#97a1b5");
  const lit = p.night ? hex("#ffd36a") : hex("#e4e9f1");
  const red = hex("#ff3b3b");
  // Lake Michigan: a thin pale band at the horizon
  m.polyScreen([[0, HORIZON], [VIEW_W, HORIZON], [VIEW_W, HORIZON + 9], [0, HORIZON + 9]], near - 2, p.night ? hex("#0d1a2e") : hex("#cfe0f2"), 0.9);
  for (const b of SKYLINE) {
    const x0 = b.x;
    const x1 = b.x + b.w;
    const top = HORIZON - b.h;
    const tw = b.tw ?? b.w;
    const inset = (b.w - tw) / 2;
    if (b.round) {
      // Twin cylinders
      for (const cx of [x0 + b.w * 0.27, x0 + b.w * 0.73]) {
        const r = b.w * 0.22;
        const pts: Pt[] = [];
        for (let i = 0; i <= 8; i++) {
          const a = Math.PI + (i / 8) * Math.PI;
          pts.push([cx + r * Math.cos(a), top + r * 0.6 + r * 0.6 * Math.sin(a)]);
        }
        m.polyScreen([[cx - r, HORIZON], ...pts, [cx + r, HORIZON]], near, body);
        for (let y = top + r; y < HORIZON - 3; y += 5) m.polyScreen([[cx - r + 1, y], [cx + r - 1, y], [cx + r - 1, y + 1], [cx - r + 1, y + 1]], near + 0.01, edge, 0.5);
      }
      continue;
    }
    // Main shaft, a darker right face, and a 1px edge
    m.polyScreen([[x0 + inset, top], [x1 - inset, top], [x1, HORIZON], [x0, HORIZON]], near, body);
    m.polyScreen([[x1 - inset, top], [x1 - inset + 3, top + 2], [x1 + 3, HORIZON], [x1, HORIZON]], near, side);
    m.polyScreen([[x0 + inset, top], [x1 - inset, top], [x1 - inset, top + 1], [x0 + inset, top + 1]], near + 0.01, edge);
    if (b.x === 262) m.polyScreen([[x0, top], [x1, top], [x1, top - 10]], near, body); // Crain's slanted crown
    // Windows: a sparse grid, lit at night
    for (let y = top + 4; y < HORIZON - 3; y += 4) {
      for (let x = x0 + 2; x < x1 - 2; x += 3) {
        if (hash(x * 3.1 + y * 7.7) > (p.night ? 0.55 : 0.4)) continue;
        m.polyScreen([[x, y], [x + 1.2, y], [x + 1.2, y + 1.6], [x, y + 1.6]], near + 0.02, lit, p.night ? 0.9 : 0.8);
      }
    }
    if (b.spire) m.polyScreen([[x0 + b.w / 2 - 1, top], [x0 + b.w / 2 + 1, top], [x0 + b.w / 2, top - b.spire]], near, side);
    for (const a of b.antennas ?? []) {
      const ax = x0 + inset + (tw * a);
      m.polyScreen([[ax - 0.6, top], [ax + 0.6, top], [ax + 0.6, top - 26], [ax - 0.6, top - 26]], near, side);
      if (p.night) {
        const blink = 0.3 + 0.7 * Math.abs(Math.sin(t * 2.2 + ax));
        m.polyScreen([[ax - 1.2, top - 27], [ax + 1.2, top - 27], [ax + 1.2, top - 25], [ax - 1.2, top - 25]], near + 0.03, red, blink);
      }
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
  /** A window band around the body (buses, trains). */
  band?: RGB;
  /** A smaller cabin on top (cars). */
  cabin?: boolean;
}

/** A closed loop given in campus coordinates. */
const loop = (...pts: Pt[]): Pt[] => pts.map(tpt);

const S57 = 6 + STREET_W / 2;
const S59 = 14 + STREET_W / 2;
const S60 = 18.5 + STREET_W / 2;
const ELLIS = 2 + STREET_W / 2;
const UNIV = 11.5 + STREET_W / 2;
const WOOD = 15.9 + STREET_W / 2;

export const VEHICLES: readonly VehicleSpec[] = [
  { id: "bus55", path: loop([0.3, S57 - 0.16], [EAST_EDGE - 0.3, S57 - 0.16], [EAST_EDGE - 0.3, S57 + 0.16], [0.3, S57 + 0.16]), speed: 1.8, offset: 6, z: GROUND, len: 1.0, wid: 0.36, h: 12, color: hex("#f3f4f6"), band: hex("#2b5fd9") },
  { id: "ugo", path: loop([UNIV - 0.15, S57], [UNIV - 0.15, S60], [WOOD + 0.15, S60], [WOOD + 0.15, S57]), speed: 1.5, offset: 14, z: GROUND, len: 0.7, wid: 0.34, h: 10, color: hex("#7a1d2b"), band: hex("#2a2a30") },
  { id: "taxi", path: loop([0.3, S59 - 0.16], [EAST_EDGE - 0.3, S59 - 0.16], [EAST_EDGE - 0.3, S59 + 0.16], [0.3, S59 + 0.16]), speed: 2.3, offset: 30, z: GROUND, len: 0.5, wid: 0.3, h: 6, color: hex("#f2c230"), cabin: true },
  { id: "car-ellis", path: loop([ELLIS - 0.15, 0.3], [ELLIS - 0.15, GRID - 0.3], [ELLIS + 0.15, GRID - 0.3], [ELLIS + 0.15, 0.3]), speed: 2.0, offset: 9, z: GROUND, len: 0.5, wid: 0.3, h: 6, color: hex("#d7262b"), cabin: true },
  { id: "car-60th", path: loop([0.3, S60 - 0.16], [EAST_EDGE - 0.3, S60 - 0.16], [EAST_EDGE - 0.3, S60 + 0.16], [0.3, S60 + 0.16]), speed: 2.1, offset: 2, z: GROUND, len: 0.5, wid: 0.3, h: 6, color: hex("#2f7d4f"), cabin: true },
  ...[0, 1, 2].map((i) => ({
    id: `metra-${i}`,
    path: loop([20.72, 0.3], [20.72, GRID - 0.3], [21.18, GRID - 0.3], [21.18, 0.3]),
    speed: 3.0,
    offset: 5 + i * 1.3,
    z: GROUND + 16,
    len: 1.1,
    wid: 0.34,
    h: 13,
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
    loop([0.5, 16.6], [EAST_EDGE - 0.5, 16.6]),
    loop([EAST_EDGE - 0.5, 16.7], [0.5, 16.7]),
    loop([15.1, 6.0], [15.1, 4.9]),
    loop([13.6, 5.8], [15.0, 5.8], [15.0, 5.0]),
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
  { id: "mansueto", label: "Mansueto", x: 15.2, y: 3.2, z: 50, keywords: ["mansueto"], primary: true },
  { id: "reg", label: "The Reg", x: 11.5, y: 2.9, z: 82, keywords: ["the reg", "reg hit", "regenstein", "reg ", "min sok lee", "midterm", "econ", "pset", "problem set", "finals", "reading period"], primary: true },
  { id: "bartlett", label: "Bartlett", x: 18.85, y: 4.15, z: 92, keywords: ["bartlett", "dining", "tikka", "omelet", "brunch"], primary: true },
  { id: "ida-noyes", label: "Ida Noyes", x: 18.4, y: 13.5, z: 72, keywords: ["the pub", "pub ", "trivia", "doc films", "ida noyes", "pretzel"], primary: true },
  { id: "maxp", label: "Max P", x: 11.5, y: 0.7, z: 62, keywords: ["max p", "palevsky", "fire alarm", "dorm"] },
  { id: "ratner", label: "Ratner", x: 5.5, y: 1.8, z: 108, keywords: ["ratner", "squat", "gym", "lap swim"] },
  { id: "robie", label: "Robie House", x: 18.25, y: 9.9, z: 62, keywords: ["robie", "wright"] },
  { id: "booth", label: "Booth", x: 18.4, y: 12.0, z: 100, keywords: ["booth", "atrium", "mba", "harper center"] },
  { id: "metra", label: "59th St Metra", x: 20.9, y: 14.4, z: 42, keywords: ["metra"] },
  { id: "logan", label: "Logan Center", x: 1.75, y: 20.1, z: 166, keywords: ["logan", "screening", "theater", "rooftop"] },
  { id: "bj", label: "Burton-Judson", x: 7.3, y: 20.0, z: 108, keywords: ["cathey", "burton", "b-j", "judson"] },
  { id: "law", label: "Law School", x: 12.0, y: 20.5, z: 90, keywords: ["law school", "fountain", "law "] },
  { id: "cobb", label: "Cobb Hall", x: 3.55, y: 10.9, z: 100, keywords: ["cobb", "sosc", "the core", "quad", "scav", "campus", "hull gate", "botany", "pond"] },
  { id: "midway", label: "The Midway", x: 18.6, y: 16.6, z: 18, keywords: ["maroons", "football", "stagg", "track meet", "intramural", "rink", "midway", "skating"] },
  { id: "sky", label: "Hyde Park sky", x: 2.0, y: 16.6, z: 70, keywords: ["rain", "snow", "frost", "weather", "°f", "wind", "sunny"] },
];

/** Where a market with no keyword match goes, by category. */
export const CATEGORY_ANCHOR: Record<string, string> = {
  sports: "midway",
  campus: "reg",
  news: "sky",
  culture: "logan",
  crypto: "booth",
  other: "ratner",
};

export { VIEW_H, VIEW_W };
