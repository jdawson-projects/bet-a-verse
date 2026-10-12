"use client";

// The campus map: a canvas drawn at low resolution (2 screen pixels per art
// pixel on desktop) and upscaled with hard edges, so it reads as pixel art.
// Buildings grow out of the ground on first paint; vehicles, clouds and stars
// move every frame. Dark mode switches to the night palette.

import { useEffect, useRef } from "react";
import s from "./city.module.css";
import { VIEW_H, VIEW_W } from "./iso";
import { Mesh } from "./mesh";
import { DAY, NIGHT, type Palette } from "./palette";
import { createRenderer } from "./renderer";
import { buildSky, buildStatic, buildVehicles, PROPS } from "./scene";

const RISE_DELAY_MS = 150;
const RISE_STAGGER_MS = 9;
const RISE_DURATION_MS = 700;

function currentPalette(): Palette {
  return document.documentElement.classList.contains("dark") ? NIGHT : DAY;
}

export function City({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas);
    const staticMesh = new Mesh(1 << 19);
    const vehicleMesh = new Mesh(1 << 14);
    const skyMesh = new Mesh(1 << 13);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const riseEnd = start + RISE_DELAY_MS + PROPS.length * RISE_STAGGER_MS + RISE_DURATION_MS;

    let palette = currentPalette();
    let staticDirty = true;
    let riseDone = reduce;
    let visible = true;
    let frame = 0;

    const riseAt = (now: number) => (i: number) => {
      if (riseDone) return 1;
      const t = Math.min(1, Math.max(0, (now - start - RISE_DELAY_MS - i * RISE_STAGGER_MS) / RISE_DURATION_MS));
      return 1 - Math.pow(1 - t, 3);
    };

    const draw = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      if (!riseDone && now >= riseEnd) {
        riseDone = true;
        staticDirty = true;
      }
      if (staticDirty || !riseDone) {
        buildStatic(staticMesh, palette, riseAt(now));
        staticDirty = false;
      }
      buildVehicles(vehicleMesh, palette, t);
      buildSky(skyMesh, palette, t);
      renderer.draw([staticMesh.view(), vehicleMesh.view(), skyMesh.view()]);
    };

    const loop = (now: number) => {
      draw(now);
      if (visible && !reduce) frame = requestAnimationFrame(loop);
    };

    // One art pixel per CSS pixel (crisp 2× on retina), like a 1× pixel-art PNG.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      const scale = 1;
      const w = Math.max(1, Math.round(rect.width / scale));
      const h = Math.max(1, Math.round((w * VIEW_H) / VIEW_W));
      renderer.resize(w, h);
      const px = VIEW_W / w;
      staticMesh.px = px;
      vehicleMesh.px = px;
      skyMesh.px = px;
      staticDirty = true;
      if (reduce) draw(performance.now());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const mo = new MutationObserver(() => {
      const next = currentPalette();
      if (next !== palette) {
        palette = next;
        staticDirty = true;
        if (reduce) draw(performance.now());
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver(([entry]) => {
      const next = entry.isIntersecting;
      if (next && !visible && !reduce) frame = requestAnimationFrame(loop);
      visible = next;
    });
    io.observe(canvas);

    if (reduce) draw(start);
    else frame = requestAnimationFrame(loop);

    return () => {
      visible = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      renderer.destroy();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={`${s.canvas} ${className}`}
      width={VIEW_W / 2}
      height={VIEW_H / 2}
      role="img"
      aria-label="Pixel-art map of the University of Chicago campus in Hyde Park: the quad, the Reg, Rockefeller Chapel and the Midway, with the 55 bus, cars and a Metra train, and bets floating over the buildings"
    />
  );
}
