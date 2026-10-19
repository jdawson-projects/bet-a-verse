import Link from "next/link";
import { City } from "@/components/city/city";
import { project, VIEW_H, VIEW_W } from "@/components/city/iso";
import { ANCHORS, CATEGORY_ANCHOR, toScene, type Anchor } from "@/components/city/scene";
import { formatCoins } from "@/lib/format";
import { formatPrice, impliedYes } from "@/lib/money";
import type { Database } from "@/lib/database.types";
import styles from "./campus-map.module.css";

export type LandingMarket = Database["public"]["Functions"]["get_landing_markets"]["Returns"][number];

/**
 * Bubbles live in the empty corners around the block and point at their
 * building with a leader line, so the drawing itself stays uncovered.
 * Each slot is a percent position inside the map frame; `side` says which
 * edge of the bubble the line leaves from.
 */
interface Slot {
  x: number;
  y: number;
  side: "left" | "right";
}

const SLOTS: Slot[] = [
  { x: 1, y: 5, side: "left" },
  { x: 1, y: 24, side: "left" },
  { x: 1, y: 80, side: "left" },
  { x: 99, y: 5, side: "right" },
  { x: 99, y: 24, side: "right" },
  { x: 99, y: 80, side: "right" },
];

/** Roughly how wide a bubble is, in percent of the frame, so the line starts at its edge. */
const BUBBLE_W = 18;
const BUBBLE_H = 9;

const MAX_BUBBLES = SLOTS.length;

export interface Bubble {
  anchor: Anchor;
  market: LandingMarket;
  slot: Slot;
  /** Anchor point, percent of the frame. */
  ax: number;
  ay: number;
}

function anchorPos(a: Anchor): { x: number; y: number } {
  const [px, py] = project(...toScene(a.x, a.y), a.z);
  return { x: (px / VIEW_W) * 100, y: (py / VIEW_H) * 100 };
}

function matchesKeyword(a: Anchor, m: LandingMarket): boolean {
  const q = m.question.toLowerCase();
  return a.keywords.some((k) => q.includes(k));
}

/**
 * Pins markets to the landmarks their questions mention (unmatched ones go by
 * category), then gives each a corner slot on its own side of the map.
 */
export function placeBubbles(markets: readonly LandingMarket[]): Bubble[] {
  const used = new Set<string>();
  const candidates: { anchor: Anchor; market: LandingMarket; fallback: boolean }[] = [];

  for (const anchor of ANCHORS) {
    const m = markets.find((mk) => !used.has(mk.id) && matchesKeyword(anchor, mk));
    if (!m) continue;
    candidates.push({ anchor, market: m, fallback: false });
    used.add(m.id);
  }
  const taken = new Set(candidates.map((c) => c.anchor.id));
  for (const m of markets) {
    if (used.has(m.id)) continue;
    const anchor = ANCHORS.find((a) => a.id === CATEGORY_ANCHOR[m.category] && !taken.has(a.id));
    if (!anchor) continue;
    candidates.push({ anchor, market: m, fallback: true });
    taken.add(anchor.id);
    used.add(m.id);
  }
  candidates.sort((a, b) => Number(a.fallback) - Number(b.fallback) || Number(Boolean(b.anchor.primary)) - Number(Boolean(a.anchor.primary)));

  // Slots on the anchor's side of the map, nearest in height first.
  const free = new Set(SLOTS);
  const out: Bubble[] = [];
  for (const c of candidates) {
    if (out.length >= MAX_BUBBLES) break;
    const { x: ax, y: ay } = anchorPos(c.anchor);
    const side = ax < 50 ? "left" : "right";
    const byHeight = (a: Slot, b: Slot) => Math.abs(a.y - ay) - Math.abs(b.y - ay);
    // Never borrow a slot from the other side: the line would cross the drawing.
    const slot = [...free].filter((s) => s.side === side).sort(byHeight)[0];
    if (!slot) continue;
    free.delete(slot);
    out.push({ anchor: c.anchor, market: c.market, slot, ax, ay });
  }
  return out;
}

function shorten(q: string, max = 64): string {
  return q.length <= max ? q : `${q.slice(0, max - 1).trimEnd()}…`;
}

/** Where a bubble goes when tapped: the sign-in page unless the caller says otherwise. */
const loginHref = (m: LandingMarket) => `/login?next=${encodeURIComponent(`/m/${m.id}`)}`;

export function CampusMap({
  markets,
  hrefFor = loginHref,
}: {
  markets: readonly LandingMarket[];
  hrefFor?: (m: LandingMarket) => string;
}) {
  const bubbles = placeBubbles(markets);
  return (
    <div className={styles.wrap}>
      <div className={styles.frame} style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <City className={styles.city} />
        <svg className={styles.leaders} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {bubbles.map(({ market, slot, ax, ay }) => {
            const sx = slot.side === "left" ? slot.x + BUBBLE_W : slot.x - BUBBLE_W;
            const sy = slot.y + BUBBLE_H / 2;
            return (
              <g key={market.id} className={styles.leader}>
                <line x1={sx} y1={sy} x2={ax} y2={ay} vectorEffect="non-scaling-stroke" />
                <circle cx={ax} cy={ay} r="0.55" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        <ul className={styles.bubbles}>
          {bubbles.map(({ anchor, market, slot }, i) => {
            const p = impliedYes(market.yes_total, market.no_total);
            return (
              <li
                key={market.id}
                className={`${styles.bubble} ${slot.side === "right" ? styles.right : ""}`}
                style={{
                  left: slot.side === "left" ? `${slot.x}%` : undefined,
                  right: slot.side === "right" ? `${100 - slot.x}%` : undefined,
                  top: `${slot.y}%`,
                  animationDelay: `${1.9 + i * 0.12}s`,
                }}
              >
                <Link
                  href={hrefFor(market)}
                  className={styles.card}
                  aria-label={`${market.question} YES ${formatPrice(p)}, NO ${formatPrice(1 - p)}. Near ${anchor.label}.`}
                >
                  <span className={styles.place}>{anchor.label}</span>
                  <span className={styles.question}>{shorten(market.question)}</span>
                  <span className={styles.odds}>
                    <span className={styles.yes}>YES {formatPrice(p)}</span>
                    <span className={styles.no}>NO {formatPrice(1 - p)}</span>
                    <span className={styles.pot}>{formatCoins(market.yes_total + market.no_total)} coins</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
