// The University of Chicago campus, Hyde Park, as an isometric scene.
// Grid: x east (Ellis → the Metra tracks), y south (55th → 60th Street).
// Streets: rows y = 1 (55th), 5 (56th), 9 (57th), 13 (58th), 17 (59th), 21 (60th);
// columns x = 3 (Ellis), 9 (University), 14 (Woodlawn), 18 (Dorchester).
// Nothing here is to scale; it's a map a student would recognize.

import type { CSSProperties, ReactNode } from "react";
import s from "./city.module.css";
import {
  boxFaces,
  GROUND,
  points,
  project,
  sortByDepth,
  TILE_H,
  TILE_W,
  type BoxSpec,
  type Faces,
  type Pt,
  type Volume,
} from "./iso";

export interface Prop {
  id: string;
  vol: Volume;
  node: ReactNode;
  /** Grows out of the ground on first paint. */
  rise?: boolean;
}

type Skin = "none" | "grid" | "gothic" | "slits";

const LIMESTONE = "#d3cdbc";
const LIMESTONE_DARK = "#c4bca7";
const SLATE = "#5a6270";
const BRICK = "#a8553f";
const GREYSTONE = "#b9b3a6";
const GLASS = "#8fb8dc";
const WHITE = "#eceee9";

const vol = (x: number, y: number, w: number, d: number, h: number, z0 = GROUND): Volume => ({
  x0: x,
  y0: y,
  x1: x + w,
  y1: y + d,
  z0,
  z1: z0 + h,
});

const cssVar = (color: string) => ({ "--c": color }) as CSSProperties;

/** A polygon of a grid-space ellipse (so ovals follow the ground plane). */
function isoEllipse(cx: number, cy: number, rx: number, ry: number, z: number, n = 28): string {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(project(cx + rx * Math.cos(t), cy + ry * Math.sin(t), z));
  }
  return points(pts);
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function FaceSet({ faces, color, skin = "none" }: { faces: Faces; color: string; skin?: Skin }) {
  return (
    <g style={cssVar(color)}>
      <polygon className={s.ft} points={faces.top} />
      <polygon className={s.fl} points={faces.left} />
      <polygon className={s.fr} points={faces.right} />
      {skin !== "none" && (
        <>
          <polygon points={faces.left} fill={`url(#bav-${skin}L)`} />
          <polygon points={faces.right} fill={`url(#bav-${skin}R)`} />
        </>
      )}
    </g>
  );
}

function Box({ b, color, skin, inset = 0 }: { b: BoxSpec; color: string; skin?: Skin; inset?: number }) {
  return <FaceSet faces={boxFaces(b, inset)} color={color} skin={skin} />;
}

/** A pitched roof on top of `b`. The far slope is drawn first and hidden by the near one. */
function Gable({ b, rise, axis, color = SLATE }: { b: BoxSpec; rise: number; axis: "x" | "y"; color?: string }) {
  const top = b.z + b.h;
  if (axis === "x") {
    const yc = b.y + b.d / 2;
    const far = points([project(b.x, b.y, top), project(b.x + b.w, b.y, top), project(b.x + b.w, yc, top + rise), project(b.x, yc, top + rise)]);
    const near = points([project(b.x, yc, top + rise), project(b.x + b.w, yc, top + rise), project(b.x + b.w, b.y + b.d, top), project(b.x, b.y + b.d, top)]);
    const end = points([project(b.x + b.w, b.y, top), project(b.x + b.w, b.y + b.d, top), project(b.x + b.w, yc, top + rise)]);
    return (
      <g style={cssVar(color)}>
        <polygon className={s.ft} points={far} />
        <polygon className={s.fr} points={end} />
        <polygon className={s.fl} points={near} />
      </g>
    );
  }
  const xc = b.x + b.w / 2;
  const far = points([project(b.x, b.y, top), project(b.x, b.y + b.d, top), project(xc, b.y + b.d, top + rise), project(xc, b.y, top + rise)]);
  const near = points([project(xc, b.y, top + rise), project(xc, b.y + b.d, top + rise), project(b.x + b.w, b.y + b.d, top), project(b.x + b.w, b.y, top)]);
  const end = points([project(b.x, b.y + b.d, top), project(b.x + b.w, b.y + b.d, top), project(xc, b.y + b.d, top + rise)]);
  return (
    <g style={cssVar(color)}>
      <polygon className={s.ft} points={far} />
      <polygon className={s.fl} points={end} />
      <polygon className={s.fr} points={near} />
    </g>
  );
}

/** Four corner pinnacles, for gothic towers. */
function Pinnacles({ b, h = 14, color = LIMESTONE_DARK }: { b: BoxSpec; h?: number; color?: string }) {
  const top = b.z + b.h;
  const sz = Math.min(b.w, b.d) * 0.22;
  const corners: Pt[] = [
    [b.x, b.y],
    [b.x + b.w - sz, b.y],
    [b.x, b.y + b.d - sz],
    [b.x + b.w - sz, b.y + b.d - sz],
  ];
  return (
    <g>
      {corners.map(([x, y], i) => (
        <Box key={i} b={{ x, y, w: sz, d: sz, z: top, h }} color={color} inset={sz * 0.3} />
      ))}
    </g>
  );
}

function Tree({ x, y, r = 5 }: { x: number; y: number; r?: number }) {
  const [bx, by] = project(x, y, GROUND);
  const [tx, ty] = project(x, y, GROUND + 5);
  const [cx, cy] = project(x, y, GROUND + 5 + r);
  return (
    <g>
      <line className={s.trunk} x1={bx} y1={by} x2={tx} y2={ty} strokeWidth={1.6} />
      <circle className={s.leaf} cx={cx} cy={cy} r={r} />
      <circle className={s.leafLight} cx={cx - r * 0.3} cy={cy - r * 0.32} r={r * 0.58} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Prop constructors
// ---------------------------------------------------------------------------

function building(id: string, b: Omit<BoxSpec, "z">, color: string, skin: Skin = "grid", extra?: ReactNode): Prop {
  const spec = { ...b, z: GROUND };
  return {
    id,
    vol: vol(b.x, b.y, b.w, b.d, b.h + 40),
    rise: true,
    node: (
      <>
        <Box b={spec} color={color} skin={skin} />
        {extra}
      </>
    ),
  };
}

/** Gothic hall: limestone box, pointed windows, slate gable roof. */
function gothic(id: string, b: Omit<BoxSpec, "z">, axis: "x" | "y", rise = 14, color = LIMESTONE): Prop {
  const spec = { ...b, z: GROUND };
  return {
    id,
    vol: vol(b.x, b.y, b.w, b.d, b.h + rise),
    rise: true,
    node: (
      <>
        <Box b={spec} color={color} skin="gothic" />
        <Gable b={spec} rise={rise} axis={axis} />
      </>
    ),
  };
}

function tower(id: string, b: Omit<BoxSpec, "z">, color = LIMESTONE, pinnacles = 14): Prop {
  const spec = { ...b, z: GROUND };
  return {
    id,
    vol: vol(b.x, b.y, b.w, b.d, b.h + pinnacles + 2),
    rise: true,
    node: (
      <>
        <Box b={spec} color={color} skin="gothic" />
        <Pinnacles b={spec} h={pinnacles} />
      </>
    ),
  };
}

function tree(id: string, x: number, y: number, r = 5): Prop {
  return { id, vol: vol(x - 0.3, y - 0.3, 0.6, 0.6, 5 + r * 2), node: <Tree x={x} y={y} r={r} /> };
}

function trees(prefix: string, list: readonly (readonly [number, number, number?])[]): Prop[] {
  return list.map(([x, y, r], i) => tree(`${prefix}-${i}`, x, y, r));
}

/** Rows of trees along a line, `step` tiles apart. */
function treeLine(prefix: string, from: Pt, to: Pt, step: number, r = 5): Prop[] {
  const out: Prop[] = [];
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.floor(len / step);
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    out.push(tree(`${prefix}-${i}`, from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, r + ((i * 7) % 3) - 1));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

function staggField(): Prop {
  // Bleachers on the west side, a track oval, two goalposts.
  const bleachers: BoxSpec = { x: 0.25, y: 2.5, w: 0.3, d: 2, z: GROUND, h: 10 };
  const [g1x, g1y] = project(1.0, 3.5, GROUND);
  const [g2x, g2y] = project(2.6, 3.5, GROUND);
  return {
    id: "stagg",
    vol: vol(0, 2, 3, 3, 16),
    node: (
      <g>
        <polygon className={s.park} points={points([project(0.2, 2.2), project(2.8, 2.2), project(2.8, 4.8), project(0.2, 4.8)].map(([x, y]) => [x, y - GROUND]))} />
        <polygon points={isoEllipse(1.7, 3.5, 1.05, 1.1, GROUND)} fill="none" stroke="#c6705a" strokeWidth={2.2} opacity={0.85} />
        <polygon points={isoEllipse(1.7, 3.5, 0.78, 0.82, GROUND)} fill="none" stroke="#f3f6f0" strokeWidth={0.8} opacity={0.8} />
        <Box b={bleachers} color="#8d94a3" />
        {[g1x, g2x].map((x, i) => (
          <g key={i} stroke="#f7f7f2" strokeWidth={1.2} fill="none">
            <line x1={x} y1={i ? g2y : g1y} x2={x} y2={(i ? g2y : g1y) - 9} />
            <line x1={x - 4} y1={(i ? g2y : g1y) - 9} x2={x + 4} y2={(i ? g2y : g1y) - 9} />
          </g>
        ))}
      </g>
    ),
  };
}

function ratner(): Prop {
  const b: BoxSpec = { x: 4.3, y: 2.4, w: 4.2, d: 2.2, z: GROUND, h: 30 };
  const masts = [5.2, 6.4, 7.6].map((x) => {
    const [bx, by] = project(x, 3.5, GROUND + 30);
    const [tx, ty] = project(x, 3.5, GROUND + 92);
    const [ax, ay] = project(x - 0.9, 2.4, GROUND + 30);
    const [cx, cy] = project(x + 0.9, 4.6, GROUND + 30);
    return { bx, by, tx, ty, ax, ay, cx, cy };
  });
  return {
    id: "ratner",
    vol: vol(4.3, 2.4, 4.2, 2.2, 95),
    rise: true,
    node: (
      <g>
        <Box b={b} color="#dfe3e4" skin="slits" />
        {masts.map((m, i) => (
          <g key={i} strokeLinecap="round">
            <line x1={m.ax} y1={m.ay} x2={m.tx} y2={m.ty} stroke="#9aa3b0" strokeWidth={0.7} />
            <line x1={m.cx} y1={m.cy} x2={m.tx} y2={m.ty} stroke="#9aa3b0" strokeWidth={0.7} />
            <line x1={m.bx} y1={m.by} x2={m.tx} y2={m.ty} stroke="#f2f4f5" strokeWidth={2.2} />
          </g>
        ))}
      </g>
    ),
  };
}

function campusNorth(): Prop {
  const base: BoxSpec = { x: 10.3, y: 2.3, w: 3.4, d: 2.4, z: GROUND, h: 22 };
  const t1: BoxSpec = { x: 10.4, y: 2.4, w: 1.2, d: 2.2, z: GROUND + 22, h: 108 };
  const t2: BoxSpec = { x: 12.4, y: 2.4, w: 1.2, d: 1.1, z: GROUND + 22, h: 76 };
  return {
    id: "campus-north",
    vol: vol(10.3, 2.3, 3.4, 2.4, 132),
    rise: true,
    node: (
      <g>
        <Box b={base} color={WHITE} skin="grid" />
        <Box b={t1} color={WHITE} skin="grid" />
        <Box b={t2} color={WHITE} skin="grid" />
      </g>
    ),
  };
}

function maxP(): Prop[] {
  const colors = ["#d9661f", "#b6433b", "#6e4a8e"];
  return colors.map((c, i) =>
    building(`maxp-${i}`, { x: 4.2 + i * 1.55, y: 6.1, w: 1.35, d: 1.0, h: 44 }, c, "grid"),
  );
}

function regenstein(): Prop {
  return building("reg", { x: 4.2, y: 7.4, w: 3.2, d: 1.5, h: 60 }, "#d6d0bf", "slits");
}

function mansueto(): Prop {
  const r = 0.66;
  const [bx, by] = project(8.15, 8.15, GROUND);
  const rx = r * Math.SQRT2 * (TILE_W / 2);
  const ry = r * Math.SQRT2 * (TILE_H / 2);
  const h = 26;
  return {
    id: "mansueto",
    vol: vol(7.5, 7.5, 1.3, 1.3, 30),
    rise: true,
    node: (
      <g>
        <ellipse cx={bx} cy={by} rx={rx + 2} ry={ry + 1} fill="#b9bcc4" opacity={0.6} />
        <ellipse cx={bx} cy={by - h * 0.42} rx={rx} ry={ry * 0.9 + h * 0.42} fill="url(#bav-glass)" stroke="#9fc3de" strokeWidth={0.6} />
        <ellipse cx={bx - rx * 0.35} cy={by - h * 0.8} rx={rx * 0.22} ry={ry * 0.5} fill="#ffffff" opacity={0.55} />
      </g>
    ),
  };
}

function harperLibrary(): Prop[] {
  const nave: Omit<BoxSpec, "z"> = { x: 5.4, y: 15.6, w: 2.2, d: 1.2, h: 52 };
  return [
    gothic("harper", nave, "x", 16),
    tower("harper-w", { x: 4.4, y: 15.6, w: 1.0, d: 1.2, h: 108 }),
    tower("harper-e", { x: 7.6, y: 15.6, w: 1.0, d: 1.2, h: 108 }),
  ];
}

function rockefeller(): Prop[] {
  return [
    gothic("rockefeller-nave", { x: 10.5, y: 15.3, w: 2.1, d: 1.3, h: 58 }, "x", 20, LIMESTONE),
    tower("rockefeller-tower", { x: 12.6, y: 15.1, w: 1.2, d: 1.5, h: 188 }, LIMESTONE, 18),
  ];
}

function saieh(): Prop[] {
  return [
    gothic("saieh-main", { x: 11.4, y: 10.3, w: 2.1, d: 0.9, h: 42 }, "x", 13),
    gothic("saieh-wing", { x: 10.3, y: 10.3, w: 0.9, d: 1.3, h: 42 }, "y", 13),
    tower("saieh-tower", { x: 10.3, y: 11.7, w: 1.0, d: 1.0, h: 122 }, LIMESTONE_DARK, 12),
  ];
}

function booth(): Prop {
  const b: BoxSpec = { x: 15.2, y: 14.2, w: 2.6, d: 1.4, z: GROUND, h: 44 };
  const top = GROUND + 44;
  const roof = points([project(15.0, 14.0, top + 8), project(18.0, 14.0, top + 8), project(18.0, 15.8, top + 8), project(15.0, 15.8, top + 8)]);
  const lip = points([project(15.0, 15.8, top + 8), project(18.0, 15.8, top + 8), project(18.0, 15.8, top + 5), project(15.0, 15.8, top + 5)]);
  const lipR = points([project(18.0, 15.8, top + 8), project(18.0, 14.0, top + 8), project(18.0, 14.0, top + 5), project(18.0, 15.8, top + 5)]);
  const posts = [
    [15.15, 15.7],
    [17.85, 15.7],
    [17.85, 14.1],
  ] as const;
  return {
    id: "booth",
    vol: vol(15.0, 14.0, 3.0, 1.8, 54),
    rise: true,
    node: (
      <g>
        <Box b={b} color={GLASS} skin="grid" />
        {posts.map(([x, y], i) => {
          const [ax, ay] = project(x, y, top);
          const [bx, by] = project(x, y, top + 5);
          return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke="#c9d1d8" strokeWidth={1} />;
        })}
        <g style={cssVar("#f4f5f2")}>
          <polygon className={s.fl} points={lip} />
          <polygon className={s.fr} points={lipR} />
          <polygon className={s.ft} points={roof} />
        </g>
      </g>
    ),
  };
}

function robieHouse(): Prop {
  const base: BoxSpec = { x: 15.3, y: 12.0, w: 2.0, d: 0.75, z: GROUND, h: 12 };
  const upper: BoxSpec = { x: 15.9, y: 12.1, w: 1.1, d: 0.55, z: GROUND + 15, h: 10 };
  const slab = (b: BoxSpec, over: number, z: number) =>
    boxFaces({ x: b.x - over, y: b.y - over * 0.6, w: b.w + over * 2, d: b.d + over * 1.2, z, h: 2.5 });
  return {
    id: "robie",
    vol: vol(15.0, 11.8, 2.6, 1.1, 30),
    rise: true,
    node: (
      <g>
        <Box b={base} color={BRICK} skin="slits" />
        <FaceSet faces={slab(base, 0.3, GROUND + 12)} color="#6f5040" />
        <Box b={upper} color={BRICK} skin="slits" />
        <FaceSet faces={slab(upper, 0.35, GROUND + 25)} color="#6f5040" />
      </g>
    ),
  };
}

function idaNoyes(): Prop[] {
  return [
    gothic("ida-noyes", { x: 15.2, y: 15.9, w: 2.3, d: 0.9, h: 34 }, "x", 12, "#9f5a46"),
    tower("ida-noyes-tower", { x: 17.0, y: 15.9, w: 0.6, d: 0.6, h: 56 }, "#9f5a46", 8),
  ];
}

function internationalHouse(): Prop[] {
  return [
    building("ihouse", { x: 19.2, y: 14.3, w: 2.2, d: 2.3, h: 64 }, "#cdbf9f", "gothic"),
    tower("ihouse-tower", { x: 19.9, y: 14.3, w: 1.0, d: 1.0, h: 116 }, "#cdbf9f", 10),
  ];
}

function logan(): Prop[] {
  return [
    building("logan-tower", { x: 0.4, y: 22.3, w: 1.3, d: 1.4, h: 136 }, "#d9d3c2", "slits"),
    building("logan-wing", { x: 1.8, y: 22.3, w: 1.0, d: 1.4, h: 26 }, "#d9d3c2", "grid"),
  ];
}

function lawSchool(): Prop {
  const b: BoxSpec = { x: 10.6, y: 22.9, w: 2.8, d: 1.0, z: GROUND, h: 64 };
  const [fx, fy] = project(12.0, 22.45, GROUND);
  return {
    id: "law",
    vol: vol(10.4, 22.0, 3.2, 2.0, 70),
    rise: true,
    node: (
      <g>
        <polygon className={s.waterDeep} points={isoEllipse(12.0, 22.45, 1.35, 0.32, GROUND - 1)} />
        <polygon className={s.water} points={isoEllipse(12.0, 22.45, 1.2, 0.24, GROUND)} opacity={0.9} />
        <g fill="#ffffff" opacity={0.85}>
          <circle cx={fx} cy={fy - 6} r={1.6} />
          <circle cx={fx - 2.5} cy={fy - 3} r={1.1} />
          <circle cx={fx + 2.5} cy={fy - 3} r={1.1} />
        </g>
        <Box b={b} color="#9fc2dd" skin="slits" />
      </g>
    ),
  };
}

function midwayRink(): Prop {
  return {
    id: "rink",
    vol: vol(12.2, 18.9, 2.6, 1.2, 4),
    node: (
      <g>
        <polygon points={isoEllipse(13.5, 19.5, 1.25, 0.58, GROUND)} fill="#e9f3fb" stroke="#b9d6ea" strokeWidth={1} />
        <polygon points={isoEllipse(13.5, 19.5, 1.0, 0.4, GROUND)} fill="none" stroke="#ffffff" strokeWidth={0.6} opacity={0.8} />
      </g>
    ),
  };
}

function botanyPond(): Prop {
  return {
    id: "pond",
    vol: vol(6.8, 11.3, 1.0, 0.8, 2),
    node: (
      <g>
        <polygon className={s.bank} points={isoEllipse(7.3, 11.7, 0.5, 0.4, GROUND)} />
        <polygon className={s.water} points={isoEllipse(7.3, 11.7, 0.42, 0.32, GROUND - 1)} />
      </g>
    ),
  };
}

function metraEmbankment(): Prop {
  const b: BoxSpec = { x: 21.6, y: 0, w: 1.2, d: 24, z: GROUND, h: 14 };
  const top = GROUND + 14;
  const rails = [21.95, 22.45].map((x) => ({ a: project(x, 0, top), b: project(x, 24, top) }));
  const ties: ReactNode[] = [];
  for (let y = 0.3; y < 24; y += 0.5) {
    const [x1, y1] = project(21.8, y, top);
    const [x2, y2] = project(22.6, y, top);
    ties.push(<line key={y} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5d6473" strokeWidth={0.7} opacity={0.7} />);
  }
  const shelter: BoxSpec = { x: 21.75, y: 16.6, w: 0.35, d: 1.1, z: top, h: 9 };
  return {
    id: "metra",
    vol: vol(21.6, 0, 1.2, 24, 14 + 10),
    node: (
      <g>
        <Box b={b} color="#8d977c" />
        {ties}
        {rails.map((r, i) => (
          <line key={i} x1={r.a[0]} y1={r.a[1]} x2={r.b[0]} y2={r.b[1]} stroke="#4c5361" strokeWidth={1.3} />
        ))}
        <Box b={shelter} color="#7f1d1d" />
      </g>
    ),
  };
}

// ---------------------------------------------------------------------------
// The whole prop list
// ---------------------------------------------------------------------------

function buildProps(): Prop[] {
  const props: Prop[] = [
    // West of Ellis
    staggField(),
    building("eckhardt", { x: 0.3, y: 6.3, w: 2.4, d: 2.3, h: 52 }, GLASS, "grid"),
    building("crerar", { x: 0.3, y: 10.3, w: 2.3, d: 2.4, h: 46 }, LIMESTONE, "slits"),
    gothic("labs", { x: 0.3, y: 14.3, w: 2.4, d: 2.3, h: 38 }, "x", 10, LIMESTONE_DARK),
    ...logan(),

    // Ellis → University
    ratner(),
    ...maxP(),
    regenstein(),
    mansueto(),
    gothic("snell-hitchcock", { x: 4.2, y: 10.2, w: 1.5, d: 0.7, h: 40 }, "x", 12),
    gothic("hull", { x: 6.0, y: 10.2, w: 1.0, d: 0.7, h: 36 }, "x", 11),
    gothic("reynolds", { x: 7.4, y: 10.2, w: 1.4, d: 0.8, h: 44 }, "x", 14),
    tower("mitchell", { x: 8.1, y: 10.2, w: 0.7, d: 0.7, h: 118 }, LIMESTONE, 12),
    botanyPond(),
    gothic("cobb", { x: 4.2, y: 11.2, w: 0.7, d: 2.2, h: 46 }, "y", 13),
    gothic("ryerson", { x: 4.2, y: 13.7, w: 0.7, d: 1.5, h: 42 }, "y", 12),
    gothic("swift", { x: 8.1, y: 11.4, w: 0.7, d: 1.4, h: 44 }, "y", 13),
    gothic("classics", { x: 8.1, y: 13.1, w: 0.7, d: 2.0, h: 40 }, "y", 12),
    ...harperLibrary(),
    gothic("burton-judson", { x: 4.3, y: 22.3, w: 4.4, d: 1.4, h: 44 }, "x", 14, LIMESTONE_DARK),
    tower("bj-tower", { x: 6.2, y: 22.3, w: 0.7, d: 0.7, h: 78 }, LIMESTONE_DARK, 10),

    // University → Woodlawn
    campusNorth(),
    building("crown-fieldhouse", { x: 10.3, y: 6.2, w: 3.4, d: 1.0, h: 34 }, LIMESTONE_DARK, "gothic"),
    gothic("bartlett", { x: 10.3, y: 7.6, w: 2.2, d: 1.2, h: 46 }, "x", 14),
    ...saieh(),
    gothic("oriental-institute", { x: 11.9, y: 11.8, w: 1.8, d: 1.0, h: 40 }, "x", 12, LIMESTONE_DARK),
    ...rockefeller(),
    lawSchool(),

    // Woodlawn → Dorchester
    building("apt-d1", { x: 15.2, y: 2.3, w: 1.1, d: 2.4, h: 36 }, GREYSTONE, "grid"),
    building("apt-d2", { x: 16.6, y: 2.3, w: 1.1, d: 2.4, h: 42 }, BRICK, "grid"),
    building("apt-d3", { x: 15.2, y: 6.3, w: 2.5, d: 1.0, h: 40 }, GREYSTONE, "grid"),
    building("apt-d4", { x: 15.2, y: 7.7, w: 1.0, d: 1.1, h: 32 }, BRICK, "grid"),
    building("apt-d5", { x: 15.2, y: 10.3, w: 2.4, d: 1.0, h: 34 }, GREYSTONE, "grid"),
    robieHouse(),
    booth(),
    ...idaNoyes(),
    building("keller", { x: 15.3, y: 22.3, w: 2.4, d: 1.4, h: 40 }, "#d8d2c0", "grid"),

    // Dorchester → the tracks
    building("apt-e1", { x: 19.2, y: 2.3, w: 1.0, d: 2.4, h: 34 }, BRICK, "grid"),
    building("apt-e2", { x: 20.4, y: 2.3, w: 1.0, d: 2.4, h: 30 }, GREYSTONE, "grid"),
    building("apt-e3", { x: 19.2, y: 6.3, w: 2.2, d: 1.0, h: 44 }, GREYSTONE, "grid"),
    building("apt-e4", { x: 19.2, y: 7.7, w: 1.0, d: 1.1, h: 36 }, BRICK, "grid"),
    building("apt-e5", { x: 19.2, y: 10.3, w: 1.0, d: 2.4, h: 48 }, "#b89b7a", "grid"),
    building("apt-e6", { x: 20.4, y: 10.3, w: 1.0, d: 2.4, h: 40 }, GREYSTONE, "grid"),
    ...internationalHouse(),
    building("apt-e7", { x: 19.2, y: 22.3, w: 2.2, d: 1.4, h: 36 }, BRICK, "grid"),

    midwayRink(),
    metraEmbankment(),

    // Trees: the quad, the Midway, 57th Street, Jackson Park
    ...trees("quad", [
      [5.6, 12.0],
      [6.9, 12.9],
      [5.4, 14.6, 6],
      [7.5, 14.4],
      [6.3, 11.3, 4],
      [7.9, 12.9, 4],
    ]),
    ...treeLine("midway-n", [0.6, 18.3], [21.0, 18.3], 1.5, 5),
    ...treeLine("midway-s", [1.3, 20.7], [21.0, 20.7], 1.5, 5),
    ...treeLine("57th-n", [11.0, 8.75], [13.6, 8.75], 1.3, 4),
    ...treeLine("saieh-lawn", [11.9, 11.3], [13.4, 11.3], 0.75, 4),
    ...treeLine("rock-lawn", [10.6, 14.4], [12.2, 14.4], 0.8, 4),
    ...treeLine("park-e", [23.3, 0.6], [23.3, 23.4], 1.2, 5),
    ...trees("misc", [
      [2.0, 20.2, 4],
      [3.5, 23.6, 4],
      [13.8, 6.6, 4],
      [8.0, 7.0, 4],
      [18.5, 12.6, 4],
      [14.6, 12.8, 4],
      [16.8, 11.4, 4],
      [20.6, 21.0, 4],
      [1.5, 17.5, 4],
    ]),
  ];
  return sortByDepth(props);
}

export const PROPS: readonly Prop[] = buildProps();

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

const STREET_ROWS = [1, 5, 9, 13, 17, 21];
const STREET_COLS = [3, 9, 14, 18];
const EAST_EDGE = 21.6;

function quadAt(x0: number, y0: number, x1: number, y1: number, z = GROUND): string {
  return points([project(x0, y0, z), project(x1, y0, z), project(x1, y1, z), project(x0, y1, z)]);
}

function dashLine(a: Pt, b: Pt) {
  return <line className={s.dash} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={0.9} strokeDasharray="5 7" />;
}

export function GroundLayer() {
  const slab = boxFaces({ x: 0, y: 0, w: 24, d: 24, z: 0, h: GROUND });
  const [sx, sy] = project(12, 12, 0);
  return (
    <g>
      <ellipse className={s.shadow} cx={sx} cy={sy + 16} rx={360} ry={150} filter="url(#bav-blur)" />
      <polygon className={s.landEdge} points={slab.left} />
      <polygon className={s.landEdge} points={slab.right} style={{ filter: "brightness(0.9)" }} />
      <polygon className={s.land} points={slab.top} />

      {/* Lawns and parks */}
      <polygon className={s.park} points={quadAt(4, 10, 9, 17)} />
      <polygon className={s.park} points={quadAt(0, 18, EAST_EDGE, 21)} />
      <polygon className={s.park} points={quadAt(10, 10, 14, 13)} opacity={0.75} />
      <polygon className={s.park} points={quadAt(10, 14, 14, 17)} opacity={0.75} />
      <polygon className={s.park} points={quadAt(15, 11.6, 18, 13)} opacity={0.6} />
      <polygon className={s.park} points={quadAt(22.8, 0, 24, 24)} />
      <polygon className={s.park} points={quadAt(0, 2, 3, 5)} opacity={0.8} />

      {/* Quad paths */}
      <g className={s.land} opacity={0.9}>
        <polygon points={quadAt(6.4, 10.2, 6.7, 16.8)} />
        <polygon points={quadAt(4.2, 13.2, 8.8, 13.45)} />
      </g>

      {/* Streets */}
      <g className={s.street}>
        {STREET_ROWS.map((y) => (
          <polygon key={`r${y}`} points={quadAt(0, y, EAST_EDGE, y + 1)} />
        ))}
        {STREET_COLS.map((x) => (
          <polygon key={`c${x}`} points={quadAt(x, 0, x + 1, 24)} />
        ))}
      </g>
      <g fill="none">
        {STREET_ROWS.map((y) => (
          <g key={`dr${y}`}>{dashLine(project(0.4, y + 0.5, GROUND), project(EAST_EDGE - 0.4, y + 0.5, GROUND))}</g>
        ))}
        {STREET_COLS.map((x) => (
          <g key={`dc${x}`}>{dashLine(project(x + 0.5, 0.4, GROUND), project(x + 0.5, 23.6, GROUND))}</g>
        ))}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Sky: stars (night only) and drifting clouds
// ---------------------------------------------------------------------------

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
}

export function SkyLayer() {
  const rand = seeded(7);
  const stars = Array.from({ length: 34 }, (_, i) => ({
    x: 20 + rand() * 840,
    y: 10 + rand() * 150,
    r: 0.6 + rand() * 1.1,
    delay: `${(i * 0.37) % 3.2}s`,
  }));
  return (
    <g>
      {stars.map((st, i) => (
        <circle key={i} className={`${s.star} ${s.twinkle}`} cx={st.x} cy={st.y} r={st.r} style={{ animationDelay: st.delay }} />
      ))}
    </g>
  );
}

export function CloudLayer() {
  const cloud = (cx: number, cy: number, k: number, cls: string) => (
    <g className={`${s.cloud} ${cls}`} key={`${cx}-${cy}`} opacity={0.95}>
      <ellipse cx={cx} cy={cy} rx={34 * k} ry={11 * k} />
      <ellipse cx={cx - 14 * k} cy={cy - 5 * k} rx={16 * k} ry={10 * k} />
      <ellipse cx={cx + 12 * k} cy={cy - 7 * k} rx={20 * k} ry={12 * k} />
    </g>
  );
  return (
    <g>
      {cloud(150, 118, 1, s.drift)}
      {cloud(690, 72, 0.8, s.driftSlow)}
      {cloud(410, 44, 0.6, s.drift)}
    </g>
  );
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
  color: string;
  /** A window band around the body (buses, trains). */
  band?: string;
  /** A smaller cabin on top (cars). */
  cabin?: boolean;
}

const loop = (...pts: Pt[]): Pt[] => pts;

export const VEHICLES: readonly VehicleSpec[] = [
  { id: "bus55", path: loop([0.3, 1.3], [21.2, 1.3], [21.2, 1.7], [0.3, 1.7]), speed: 2.0, offset: 6, z: GROUND, len: 1.15, wid: 0.42, h: 11, color: "#f3f4f6", band: "#2b5fd9" },
  { id: "ugo", path: loop([9.3, 5.3], [9.3, 21.7], [14.7, 21.7], [14.7, 5.3]), speed: 1.7, offset: 14, z: GROUND, len: 0.8, wid: 0.4, h: 9, color: "#7a1d2b", band: "#2a2a30" },
  { id: "taxi", path: loop([0.3, 9.3], [21.2, 9.3], [21.2, 9.7], [0.3, 9.7]), speed: 2.5, offset: 30, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: "#f2c230", cabin: true },
  { id: "car-ellis", path: loop([3.3, 0.3], [3.3, 23.7], [3.7, 23.7], [3.7, 0.3]), speed: 2.1, offset: 9, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: "#d7262b", cabin: true },
  { id: "car-59th", path: loop([0.3, 17.3], [21.2, 17.3], [21.2, 17.7], [0.3, 17.7]), speed: 2.3, offset: 22, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: "#f5f6f8", cabin: true },
  { id: "car-dorch", path: loop([18.3, 0.3], [18.3, 23.7], [18.7, 23.7], [18.7, 0.3]), speed: 1.9, offset: 33, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: "#1f3a8a", cabin: true },
  { id: "car-60th", path: loop([0.3, 21.3], [21.2, 21.3], [21.2, 21.7], [0.3, 21.7]), speed: 2.2, offset: 2, z: GROUND, len: 0.6, wid: 0.34, h: 5, color: "#2f7d4f", cabin: true },
  ...[0, 1, 2].map((i) => ({
    id: `metra-${i}`,
    path: loop([21.95, 0.3], [21.95, 23.7], [22.45, 23.7], [22.45, 0.3]),
    speed: 3.2,
    offset: 5 + i * 1.5,
    z: GROUND + 14,
    len: 1.3,
    wid: 0.38,
    h: 12,
    color: "#ccd1d8",
    band: "#e3692b",
  })),
];

export interface Pose {
  box: BoxSpec;
  vol: Volume;
}

function pathLength(path: readonly Pt[]): number[] {
  const lens: number[] = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    lens.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return lens;
}

const LENGTHS = new Map(VEHICLES.map((v) => [v.id, pathLength(v.path)]));

/** Where a vehicle is after `t` seconds: an oriented box on its path. */
export function poseAt(v: VehicleSpec, t: number): Pose {
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
  const box: BoxSpec = { x: cx - w / 2, y: cy - d / 2, w, d, z: v.z, h: v.h };
  return { box, vol: vol(box.x, box.y, w, d, v.h + (v.cabin ? 5 : 0), v.z) };
}

/** Polygon point strings for a vehicle's parts, keyed by `data-f` on its polygons. */
export function vehicleParts(v: VehicleSpec, pose: Pose): Record<string, string> {
  const body = boxFaces(pose.box);
  const parts: Record<string, string> = { top: body.top, left: body.left, right: body.right };
  if (v.band) {
    const band = boxFaces({ ...pose.box, z: pose.box.z + v.h * 0.45, h: v.h * 0.35 });
    parts.bandL = band.left;
    parts.bandR = band.right;
  }
  if (v.cabin) {
    const { box } = pose;
    const alongX = box.w >= box.d;
    const cab = boxFaces({
      x: box.x + (alongX ? box.w * 0.3 : box.w * 0.1),
      y: box.y + (alongX ? box.d * 0.1 : box.d * 0.3),
      w: alongX ? box.w * 0.45 : box.w * 0.8,
      d: alongX ? box.d * 0.8 : box.d * 0.45,
      z: box.z + v.h,
      h: 4,
    });
    parts.cabT = cab.top;
    parts.cabL = cab.left;
    parts.cabR = cab.right;
  }
  return parts;
}

export function VehicleNode({ v }: { v: VehicleSpec }) {
  const parts = vehicleParts(v, poseAt(v, 0));
  return (
    <g data-vehicle={v.id} className={s.fadeIn} style={{ animationDelay: "1.5s" }}>
      <g style={cssVar(v.color)}>
        <polygon className={s.fl} data-f="left" points={parts.left} />
        <polygon className={s.fr} data-f="right" points={parts.right} />
        <polygon className={s.ft} data-f="top" points={parts.top} />
      </g>
      {v.band && (
        <g style={cssVar(v.band)}>
          <polygon className={s.fl} data-f="bandL" points={parts.bandL} />
          <polygon className={s.fr} data-f="bandR" points={parts.bandR} />
        </g>
      )}
      {v.cabin && (
        <g style={cssVar("#2b3340")}>
          <polygon className={s.fl} data-f="cabL" points={parts.cabL} />
          <polygon className={s.fr} data-f="cabR" points={parts.cabR} />
          <polygon className={s.ft} data-f="cabT" points={parts.cabT} />
        </g>
      )}
    </g>
  );
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
  /** Shown on phones too (the rest are desktop-only). */
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
