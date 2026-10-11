"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { formatCoins } from "@/lib/format";
import { useViewer } from "./viewer-context";

export function CoinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="var(--coin)" />
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" />
      <path d="M10 6.2v7.6M7.8 8.2h3.4a1.5 1.5 0 0 1 0 3H8.8" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** The viewer's coin balance; ticks to new values and flashes on change. */
export function Balance() {
  const { balance } = useViewer();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(balance);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(balance);

  useEffect(() => {
    const from = prev.current;
    prev.current = balance;
    if (from === balance) return;
    const dir = balance > from ? "up" : "down";
    const t0 = setTimeout(() => setFlash(dir), 0);
    const t = setTimeout(() => setFlash(null), 600);
    if (reduce) {
      const t1 = setTimeout(() => setShown(balance), 0);
      return () => [t0, t, t1].forEach(clearTimeout);
    }
    const controls = animate(from, balance, {
      duration: 0.45,
      ease: "easeOut",
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => {
      controls.stop();
      clearTimeout(t0);
      clearTimeout(t);
    };
  }, [balance, reduce]);

  return (
    <span
      className={`tabular inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 transition-colors duration-300 ${
        flash === "down"
          ? "bg-no-soft text-no-strong ring-no/30"
          : flash === "up"
            ? "bg-yes-soft text-yes-strong ring-yes/30"
            : "bg-surface ring-line"
      }`}
      aria-label={`${formatCoins(balance)} coins`}
      data-testid="balance"
    >
      <CoinIcon />
      <span aria-hidden>{formatCoins(shown)}</span>
    </span>
  );
}
