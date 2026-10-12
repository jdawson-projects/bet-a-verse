// Draws Mesh triangle lists into a low-resolution canvas. WebGL with
// anti-aliasing off gives true pixel-art edges and a depth buffer for free;
// a Canvas 2D painter's-algorithm fallback covers the rare browser without it.

import { VIEW_H, VIEW_W } from "./iso";
import { FLOATS_PER_VERTEX } from "./mesh";

export interface Renderer {
  resize(width: number, height: number): void;
  draw(layers: readonly Float32Array[]): void;
  destroy(): void;
}

const VERT = `
attribute vec2 a_pos;
attribute float a_near;
attribute vec4 a_color;
uniform vec2 u_view;
varying vec4 v_color;
void main() {
  vec2 clip = vec2(a_pos.x / u_view.x * 2.0 - 1.0, 1.0 - a_pos.y / u_view.y * 2.0);
  gl_Position = vec4(clip, -a_near / 400.0, 1.0);
  v_color = a_color;
}`;

const FRAG = `
precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader error");
  return sh;
}

class GLRenderer implements Renderer {
  private gl: WebGLRenderingContext;
  private buffer: WebGLBuffer;
  private program: WebGLProgram;
  private uView: WebGLUniformLocation;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: false, depth: true });
    if (!gl) throw new Error("no webgl");
    this.gl = gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link error");
    gl.useProgram(program);
    this.program = program;
    this.uView = gl.getUniformLocation(program, "u_view")!;
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const stride = FLOATS_PER_VERTEX * 4;
    const aPos = gl.getAttribLocation(program, "a_pos");
    const aNear = gl.getAttribLocation(program, "a_near");
    const aColor = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aNear);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(aNear, 1, gl.FLOAT, false, stride, 8);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 12);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.uniform2f(this.uView, VIEW_W, VIEW_H);
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  draw(layers: readonly Float32Array[]) {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (const data of layers) {
      if (data.length === 0) continue;
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, data.length / FLOATS_PER_VERTEX);
    }
  }

  destroy() {
    // Free the GPU objects but keep the context: React may remount on the same
    // canvas (StrictMode in dev), and a lost context can't be reused.
    const gl = this.gl;
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
  }
}

/** Painter's algorithm on a 2D context: sort triangles by nearness and fill. Anti-aliased, but it works everywhere. */
class CanvasRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private scale = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.scale = width / VIEW_W;
  }

  draw(layers: readonly Float32Array[]) {
    const ctx = this.ctx;
    const s = this.scale;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const tris: { near: number; data: Float32Array; i: number }[] = [];
    for (const data of layers) {
      for (let i = 0; i + FLOATS_PER_VERTEX * 3 <= data.length; i += FLOATS_PER_VERTEX * 3) {
        tris.push({ near: (data[i + 2] + data[i + 9] + data[i + 16]) / 3, data, i });
      }
    }
    tris.sort((a, b) => a.near - b.near);
    for (const t of tris) {
      const d = t.data;
      const i = t.i;
      ctx.fillStyle = `rgba(${Math.round(d[i + 3] * 255)},${Math.round(d[i + 4] * 255)},${Math.round(d[i + 5] * 255)},${d[i + 6]})`;
      ctx.beginPath();
      ctx.moveTo(d[i] * s, d[i + 1] * s);
      ctx.lineTo(d[i + 7] * s, d[i + 8] * s);
      ctx.lineTo(d[i + 14] * s, d[i + 15] * s);
      ctx.closePath();
      ctx.fill();
    }
  }

  destroy() {}
}

const NOOP: Renderer = { resize() {}, draw() {}, destroy() {} };

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  try {
    return new GLRenderer(canvas);
  } catch {
    try {
      return new CanvasRenderer(canvas);
    } catch {
      return NOOP;
    }
  }
}
