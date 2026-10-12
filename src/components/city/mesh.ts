// Triangle-list builder for the pixel-art renderer. Every vertex is
// [screenX, screenY, nearness, r, g, b, a] in scene units; the GPU rasterizes
// without anti-aliasing and the depth buffer sorts by nearness.

import { GROUND, nearness, project, type BoxSpec, type P3 } from "./iso";
import type { RGB, Shades } from "./palette";

export const FLOATS_PER_VERTEX = 7;

export class Mesh {
  data: Float32Array;
  length = 0;
  /** Scene units per rendered pixel; outlines are drawn this wide. */
  px = 1.7;
  /** Scales heights above the ground (the rise-in animation). */
  heightScale = 1;

  constructor(capacity = 1 << 18) {
    this.data = new Float32Array(capacity);
  }

  reset() {
    this.length = 0;
  }

  get vertexCount() {
    return this.length / FLOATS_PER_VERTEX;
  }

  view(): Float32Array {
    return this.data.subarray(0, this.length);
  }

  private grow() {
    const next = new Float32Array(this.data.length * 2);
    next.set(this.data);
    this.data = next;
  }

  /** Raw vertex in screen space. */
  pushScreen(sx: number, sy: number, near: number, c: RGB, a = 1) {
    if (this.length + FLOATS_PER_VERTEX > this.data.length) this.grow();
    const d = this.data;
    let i = this.length;
    d[i++] = sx;
    d[i++] = sy;
    d[i++] = near;
    d[i++] = c[0];
    d[i++] = c[1];
    d[i++] = c[2];
    d[i++] = a;
    this.length = i;
  }

  private zOf(z: number) {
    return z > GROUND ? GROUND + (z - GROUND) * this.heightScale : z;
  }

  /** Vertex in grid space. `bias` nudges it toward the camera (for details on faces). */
  push(p: P3, c: RGB, a = 1, bias = 0) {
    const z = this.zOf(p[2]);
    const [sx, sy] = project(p[0], p[1], z);
    this.pushScreen(sx, sy, nearness(p[0], p[1], z) + bias, c, a);
  }

  tri(a: P3, b: P3, c: P3, color: RGB, alpha = 1, bias = 0) {
    this.push(a, color, alpha, bias);
    this.push(b, color, alpha, bias);
    this.push(c, color, alpha, bias);
  }

  /** Convex polygon (fan) in grid space. */
  poly(pts: readonly P3[], color: RGB, alpha = 1, bias = 0) {
    for (let i = 1; i + 1 < pts.length; i++) this.tri(pts[0], pts[i], pts[i + 1], color, alpha, bias);
  }

  /** Convex polygon in screen space with one nearness for every vertex. */
  polyScreen(pts: readonly (readonly [number, number])[], near: number, color: RGB, alpha = 1) {
    for (let i = 1; i + 1 < pts.length; i++) {
      this.pushScreen(pts[0][0], pts[0][1], near, color, alpha);
      this.pushScreen(pts[i][0], pts[i][1], near, color, alpha);
      this.pushScreen(pts[i + 1][0], pts[i + 1][1], near, color, alpha);
    }
  }

  /** A line between two grid points, `width` in rendered pixels, drawn as a screen-space quad. */
  line(p: P3, q: P3, width: number, color: RGB, alpha = 1, bias = 0) {
    const zp = this.zOf(p[2]);
    const zq = this.zOf(q[2]);
    const [ax, ay] = project(p[0], p[1], zp);
    const [bx, by] = project(q[0], q[1], zq);
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const w = (width * this.px) / 2;
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    // Extend the ends by half a width so corners meet.
    const ex = (dx / len) * w;
    const ey = (dy / len) * w;
    const na = nearness(p[0], p[1], zp) + bias;
    const nb = nearness(q[0], q[1], zq) + bias;
    const c = color;
    this.pushScreen(ax - ex + nx, ay - ey + ny, na, c, alpha);
    this.pushScreen(bx + ex + nx, by + ey + ny, nb, c, alpha);
    this.pushScreen(bx + ex - nx, by + ey - ny, nb, c, alpha);
    this.pushScreen(ax - ex + nx, ay - ey + ny, na, c, alpha);
    this.pushScreen(bx + ex - nx, by + ey - ny, nb, c, alpha);
    this.pushScreen(ax - ex - nx, ay - ey - ny, na, c, alpha);
  }

  /** The three visible faces of a box, optionally tapered, with a 1px dark outline. */
  box(b: BoxSpec, s: Shades, opts: { inset?: number; outline?: boolean; alpha?: number } = {}) {
    const { inset = 0, outline = true, alpha = 1 } = opts;
    const t = b.z + b.h;
    const A: P3 = [b.x + inset, b.y + inset, t];
    const B: P3 = [b.x + b.w - inset, b.y + inset, t];
    const C: P3 = [b.x + b.w - inset, b.y + b.d - inset, t];
    const D: P3 = [b.x + inset, b.y + b.d - inset, t];
    const Bb: P3 = [b.x + b.w, b.y, b.z];
    const Cb: P3 = [b.x + b.w, b.y + b.d, b.z];
    const Db: P3 = [b.x, b.y + b.d, b.z];
    this.poly([A, B, C, D], s.top, alpha);
    this.poly([D, C, Cb, Db], s.left, alpha);
    this.poly([C, B, Bb, Cb], s.right, alpha);
    if (outline) {
      const e = s.edge;
      const k = 0.04;
      for (const [p, q] of [
        [B, C],
        [C, D],
        [D, Db],
        [C, Cb],
        [B, Bb],
        [Db, Cb],
        [Cb, Bb],
      ] as const) {
        this.line(p, q, 1, e, alpha, k);
      }
      // Pixel-art bevel: the top face's far edges catch the light.
      const hi: RGB = [Math.min(1, s.top[0] + 0.14), Math.min(1, s.top[1] + 0.14), Math.min(1, s.top[2] + 0.12)];
      this.line(A, B, 1, hi, alpha, k);
      this.line(D, A, 1, hi, alpha, k);
    }
  }

  /**
   * Pitched roof on top of `b`. The far slope is hidden by the near one when the
   * pitch is steep. `tiles` draws rows of tiles across the near slope, that many
   * scene units apart.
   */
  gable(b: BoxSpec, rise: number, axis: "x" | "y", s: Shades, tiles = 0) {
    const t = b.z + b.h;
    const rows = tiles > 0 ? Math.floor(rise / tiles) : 0;
    if (axis === "x") {
      const yc = b.y + b.d / 2;
      const r1: P3 = [b.x, yc, t + rise];
      const r2: P3 = [b.x + b.w, yc, t + rise];
      this.poly([[b.x, b.y, t], [b.x + b.w, b.y, t], r2, r1], s.top);
      this.poly([r1, r2, [b.x + b.w, b.y + b.d, t], [b.x, b.y + b.d, t]], s.left);
      this.poly([[b.x + b.w, b.y, t], [b.x + b.w, b.y + b.d, t], r2], s.right);
      for (let k = 1; k <= rows; k++) {
        const u = (k * tiles) / rise;
        const y = yc + (b.d / 2) * (1 - u);
        const z = t + rise * u;
        this.line([b.x, y, z], [b.x + b.w, y, z], 1, s.right, 0.45, 0.02);
      }
      this.line(r1, r2, 1, s.edge, 1, 0.04);
      this.line(r2, [b.x + b.w, b.y + b.d, t], 1, s.edge, 1, 0.04);
      this.line(r2, [b.x + b.w, b.y, t], 1, s.edge, 1, 0.04);
      this.line(r1, [b.x, b.y + b.d, t], 1, s.edge, 1, 0.04);
      return;
    }
    const xc = b.x + b.w / 2;
    const r1: P3 = [xc, b.y, t + rise];
    const r2: P3 = [xc, b.y + b.d, t + rise];
    this.poly([[b.x, b.y, t], [b.x, b.y + b.d, t], r2, r1], s.top);
    this.poly([r1, r2, [b.x + b.w, b.y + b.d, t], [b.x + b.w, b.y, t]], s.right);
    this.poly([[b.x, b.y + b.d, t], [b.x + b.w, b.y + b.d, t], r2], s.left);
    for (let k = 1; k <= rows; k++) {
      const u = (k * tiles) / rise;
      const x = xc + (b.w / 2) * (1 - u);
      const z = t + rise * u;
      this.line([x, b.y, z], [x, b.y + b.d, z], 1, s.edge, 0.3, 0.02);
    }
    this.line(r1, r2, 1, s.edge, 1, 0.04);
    this.line(r2, [b.x + b.w, b.y + b.d, t], 1, s.edge, 1, 0.04);
    this.line(r2, [b.x, b.y + b.d, t], 1, s.edge, 1, 0.04);
    this.line(r1, [b.x + b.w, b.y, t], 1, s.edge, 1, 0.04);
  }

  /** A regular n-sided tower (turrets). Sides are shaded by which way they face. */
  prism(cx: number, cy: number, r: number, z: number, h: number, n: number, s: Shades) {
    const ring = (zz: number): P3[] =>
      Array.from({ length: n }, (_, i) => {
        const a = ((i + 0.5) / n) * Math.PI * 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a), zz];
      });
    const bottom = ring(z);
    const top = ring(z + h);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const mx = (bottom[i][0] + bottom[j][0]) / 2 - cx;
      const my = (bottom[i][1] + bottom[j][1]) / 2 - cy;
      const color = mx > my ? s.right : s.left;
      this.poly([top[i], top[j], bottom[j], bottom[i]], color);
      this.line(top[i], bottom[i], 1, s.edge, 1, 0.03);
    }
    this.poly(top, s.top);
  }

  /** A cone on top of a prism: a conical turret roof. */
  cone(cx: number, cy: number, r: number, z: number, h: number, n: number, s: Shades) {
    const apex: P3 = [cx, cy, z + h];
    for (let i = 0; i < n; i++) {
      const a0 = ((i + 0.5) / n) * Math.PI * 2;
      const a1 = ((i + 1.5) / n) * Math.PI * 2;
      const p0: P3 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0), z];
      const p1: P3 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1), z];
      const mx = (p0[0] + p1[0]) / 2 - cx;
      const my = (p0[1] + p1[1]) / 2 - cy;
      this.tri(apex, p1, p0, mx > my ? s.right : s.left);
      this.line(apex, p0, 1, s.edge, 1, 0.03);
    }
  }

  /** Polygon of a grid-space ellipse at height z. */
  ellipse(cx: number, cy: number, rx: number, ry: number, z: number, color: RGB, alpha = 1, bias = 0, n = 20) {
    const pts: P3[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t), z]);
    }
    this.poly(pts, color, alpha, bias);
  }

  /** A flat square "pixel" of `size` rendered pixels at a grid point. */
  dot(p: P3, size: number, color: RGB, alpha = 1, bias = 0) {
    const z = this.zOf(p[2]);
    const [sx, sy] = project(p[0], p[1], z);
    const h = (size * this.px) / 2;
    const n = nearness(p[0], p[1], z) + bias;
    this.polyScreen(
      [
        [sx - h, sy - h],
        [sx + h, sy - h],
        [sx + h, sy + h],
        [sx - h, sy + h],
      ],
      n,
      color,
      alpha,
    );
  }
}
