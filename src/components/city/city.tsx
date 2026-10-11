"use client";

// Renders the campus and keeps the vehicles moving. Buildings are static SVG
// drawn back-to-front once; each frame the vehicles get new polygon points and
// are re-slotted in the DOM so they pass behind and in front of buildings.

import { useLayoutEffect, useRef } from "react";
import s from "./city.module.css";
import { insertionIndex, screenBox, VIEW_H, VIEW_W, type ScreenBox, type Volume } from "./iso";
import { CloudLayer, GroundLayer, poseAt, PROPS, SkyLayer, VehicleNode, vehicleParts, VEHICLES } from "./scene";

const SKEW = 26.565; // atan(1/2): the slope of isometric face edges

function Defs() {
  const win = (id: string, skew: number, w: number, h: number, rects: readonly (readonly [number, number, number, number])[]) => (
    <pattern id={id} width={w} height={h} patternUnits="userSpaceOnUse" patternTransform={`skewY(${skew})`}>
      {rects.map(([x, y, rw, rh], i) => (
        <rect key={i} className={s.win} x={x} y={y} width={rw} height={rh} />
      ))}
    </pattern>
  );
  const grid = [
    [1, 1.5, 2.2, 2.6],
    [5, 1.5, 2.2, 2.6],
    [3, 6, 2.2, 2.6],
    [7, 6, 2.2, 2.6],
  ] as const;
  const gothic = [
    [1.5, 1, 1.8, 4.5],
    [5.5, 1, 1.8, 4.5],
  ] as const;
  const slits = [
    [1, 0, 0.9, 10],
    [4, 0, 0.9, 10],
    [7, 0, 0.9, 10],
  ] as const;
  return (
    <defs>
      {win("bav-gridL", SKEW, 9, 9, grid)}
      {win("bav-gridR", -SKEW, 9, 9, grid)}
      {win("bav-gothicL", SKEW, 8, 9, gothic)}
      {win("bav-gothicR", -SKEW, 8, 9, gothic)}
      {win("bav-slitsL", SKEW, 9, 10, slits)}
      {win("bav-slitsR", -SKEW, 9, 10, slits)}
      <linearGradient id="bav-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d8ecf8" />
        <stop offset="0.55" stopColor="#8fbbdc" />
        <stop offset="1" stopColor="#4f86b4" />
      </linearGradient>
      <filter id="bav-blur" x="-30%" y="-60%" width="160%" height="220%">
        <feGaussianBlur stdDeviation="16" />
      </filter>
    </defs>
  );
}

interface StaticRef {
  vol: Volume;
  box: ScreenBox;
  el: Element;
}

export function City({ className = "" }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);

  // Place the vehicles correctly before first paint, then animate.
  useLayoutEffect(() => {
    const world = worldRef.current;
    const svg = svgRef.current;
    if (!world || !svg) return;

    const statics: StaticRef[] = [];
    world.querySelectorAll<SVGGElement>("[data-static]").forEach((el) => {
      const prop = PROPS[Number(el.dataset.static)];
      statics.push({ vol: prop.vol, box: screenBox(prop.vol), el });
    });

    const vehicles = VEHICLES.map((spec) => {
      const el = world.querySelector<SVGGElement>(`[data-vehicle="${spec.id}"]`)!;
      const parts = new Map<string, SVGPolygonElement>();
      el.querySelectorAll<SVGPolygonElement>("[data-f]").forEach((p) => parts.set(p.dataset.f!, p));
      return { spec, el, parts, slot: -1 };
    });

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let frame = 0;
    const start = performance.now();

    const render = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      for (const v of vehicles) {
        const pose = poseAt(v.spec, t);
        const parts = vehicleParts(v.spec, pose);
        for (const [k, el] of v.parts) el.setAttribute("points", parts[k]);
        const slot = insertionIndex(pose.vol, statics);
        if (slot !== v.slot) {
          v.slot = slot;
          world.insertBefore(v.el, statics[slot]?.el ?? null);
        }
      }
    };

    const loop = (now: number) => {
      render(now);
      if (visible && !reduce) frame = requestAnimationFrame(loop);
    };

    render(start);
    if (!reduce) frame = requestAnimationFrame(loop);

    // Don't burn frames while the map is scrolled out of view.
    const io = new IntersectionObserver(([entry]) => {
      const next = entry.isIntersecting;
      if (next && !visible && !reduce) frame = requestAnimationFrame(loop);
      visible = next;
    });
    io.observe(svg);

    return () => {
      visible = false;
      cancelAnimationFrame(frame);
      io.disconnect();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      className={`${s.root} ${className}`}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label="Isometric map of the University of Chicago campus in Hyde Park, with cars on the streets, the 55 bus, a Metra train and bets floating over the buildings"
    >
      <Defs />
      <SkyLayer />
      <GroundLayer />
      <g ref={worldRef}>
        {PROPS.map((p, i) => (
          <g
            key={p.id}
            data-static={i}
            className={p.rise ? s.rise : undefined}
            style={p.rise ? { animationDelay: `${120 + i * 9}ms` } : undefined}
          >
            {p.node}
          </g>
        ))}
        {VEHICLES.map((v) => (
          <VehicleNode key={v.id} v={v} />
        ))}
      </g>
      <CloudLayer />
    </svg>
  );
}
