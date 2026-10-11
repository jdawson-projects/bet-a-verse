import { formatPrice, impliedYes } from "@/lib/money";

/** "YES 0.62 · NO 0.38" as two pills. Text labels carry the meaning; color only reinforces it. */
export function PricePills({ yes, no, size = "lg" }: { yes: number; no: number; size?: "lg" | "sm" }) {
  const p = impliedYes(yes, no);
  const pad = size === "lg" ? "px-3.5 py-1.5 text-lg" : "px-2.5 py-1 text-sm";
  return (
    <div className="flex items-center gap-2 font-extrabold tabular" aria-label={`YES ${formatPrice(p)}, NO ${formatPrice(1 - p)}`}>
      <span className={`rounded-full bg-yes text-white ${pad}`}>YES {formatPrice(p)}</span>
      <span aria-hidden className="opacity-60">·</span>
      <span className={`rounded-full bg-no text-white ${pad}`}>NO {formatPrice(1 - p)}</span>
    </div>
  );
}

/** Thin YES/NO split bar of implied probability. */
export function SplitBar({ yes, no, className = "" }: { yes: number; no: number; className?: string }) {
  const pct = Math.round(impliedYes(yes, no) * 100);
  return (
    <div className={`flex h-2 overflow-hidden rounded-full ${className}`} aria-hidden>
      <div className="bg-yes" style={{ width: `${pct}%` }} />
      <div className="flex-1 bg-no" />
    </div>
  );
}
