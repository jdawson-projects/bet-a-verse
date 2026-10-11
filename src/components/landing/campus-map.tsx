import Link from "next/link";
import { City } from "@/components/city/city";
import { percent, project, VIEW_H, VIEW_W } from "@/components/city/iso";
import { ANCHORS, CATEGORY_ANCHOR, type Anchor } from "@/components/city/scene";
import { formatCoins } from "@/lib/format";
import { formatPrice, impliedYes } from "@/lib/money";
import type { Database } from "@/lib/database.types";
import styles from "./campus-map.module.css";

export type LandingMarket = Database["public"]["Functions"]["get_landing_markets"]["Returns"][number];

const MAX_BUBBLES = 6;
/** Minimum spacing between bubbles, in percent of the map width (height weighted up, bubbles are wide). */
const MIN_GAP = 14.5;
/** How many bubbles phones show (the rest appear from the sm breakpoint up). */
const MOBILE_BUBBLES = 3;

function bubblePos(a: Anchor) {
  const [px, py] = project(a.x, a.y, a.z);
  return { x: (px / VIEW_W) * 100, y: (py / VIEW_H) * 100 };
}

function farEnough(a: Anchor, placed: readonly Anchor[]): boolean {
  const p = bubblePos(a);
  return placed.every((b) => {
    const q = bubblePos(b);
    return Math.hypot(p.x - q.x, (p.y - q.y) * 1.2) >= MIN_GAP;
  });
}

/**
 * Pins markets to the landmarks their questions mention (unmatched ones go by
 * category), then keeps a spread-out handful so bubbles don't pile up.
 */
export function placeBubbles(markets: readonly LandingMarket[]): { anchor: Anchor; market: LandingMarket }[] {
  const used = new Set<string>();
  const candidates: { anchor: Anchor; market: LandingMarket }[] = [];

  for (const anchor of ANCHORS) {
    const m = markets.find((mk) => !used.has(mk.id) && anchor.keywords.some((k) => mk.question.toLowerCase().includes(k)));
    if (!m) continue;
    candidates.push({ anchor, market: m });
    used.add(m.id);
  }
  const taken = new Set(candidates.map((c) => c.anchor.id));
  for (const m of markets) {
    if (used.has(m.id)) continue;
    const anchor = ANCHORS.find((a) => a.id === CATEGORY_ANCHOR[m.category] && !taken.has(a.id));
    if (!anchor) continue;
    candidates.push({ anchor, market: m });
    taken.add(anchor.id);
    used.add(m.id);
  }

  // Landmark matches beat category fallbacks, and primary anchors go first; then greedily keep the ones with room.
  const isFallback = (c: { anchor: Anchor; market: LandingMarket }) => !matchesKeyword(c);
  candidates.sort(
    (a, b) =>
      Number(isFallback(a)) - Number(isFallback(b)) ||
      Number(Boolean(b.anchor.primary)) - Number(Boolean(a.anchor.primary)),
  );
  const out: { anchor: Anchor; market: LandingMarket }[] = [];
  for (const c of candidates) {
    if (out.length >= MAX_BUBBLES) break;
    if (farEnough(c.anchor, out.map((o) => o.anchor))) out.push(c);
  }
  return out;
}

function matchesKeyword(c: { anchor: Anchor; market: LandingMarket }): boolean {
  const q = c.market.question.toLowerCase();
  return c.anchor.keywords.some((k) => q.includes(k));
}

function shorten(q: string, max = 58): string {
  return q.length <= max ? q : `${q.slice(0, max - 1).trimEnd()}…`;
}

export function CampusMap({ markets }: { markets: readonly LandingMarket[] }) {
  const bubbles = placeBubbles(markets);
  return (
    <div className={styles.frame} style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
      <City className={styles.city} />
      {bubbles.map(({ anchor, market }, i) => {
        const p = impliedYes(market.yes_total, market.no_total);
        const pos = percent(anchor.x, anchor.y, anchor.z);
        return (
          <Link
            key={market.id}
            href={`/login?next=${encodeURIComponent(`/m/${market.id}`)}`}
            className={`${styles.bubble} ${i < MOBILE_BUBBLES ? "" : styles.secondary}`}
            style={{ left: pos.left, top: pos.top, animationDelay: `${1.9 + i * 0.12}s, ${i * 0.7}s` }}
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
        );
      })}
    </div>
  );
}
