"use client";

import { STAKE_OPTIONS, type Stake } from "@/lib/money";

/** Segmented 1 / 5 / 10 / 25 coin picker. */
export function StakePill({
  value,
  onChange,
  max = 25,
  balance,
  tone = "default",
  className = "",
}: {
  value: Stake;
  onChange: (s: Stake) => void;
  max?: number;
  balance?: number;
  /** onDark: translucent styling for use on a market card */
  tone?: "default" | "onDark";
  className?: string;
}) {
  const track = tone === "onDark" ? "bg-black/30 ring-white/20 backdrop-blur" : "bg-surface ring-line";
  const idle = tone === "onDark" ? "text-white/75 hover:text-white" : "text-muted hover:text-fg";
  return (
    <div role="radiogroup" aria-label="Stake per bet" className={`flex items-center rounded-full p-1 ring-1 ${track} ${className}`}>
      {tone === "onDark" && <span className="pl-2 pr-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Stake</span>}
      {STAKE_OPTIONS.map((s) => {
        const disabled = s > max || (balance !== undefined && s > balance);
        const selected = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${s} coin${s === 1 ? "" : "s"}`}
            disabled={disabled}
            onClick={() => onChange(s)}
            className={`tabular min-w-9 rounded-full px-2.5 py-1.5 text-sm font-extrabold transition ${
              selected ? "bg-coin text-white shadow-sm" : idle
            } disabled:opacity-30`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
