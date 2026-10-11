import { CheckIcon, XIcon } from "./icons";

/** Small YES/NO badge. Always carries the word, never color alone. */
export function SideBadge({ side, className = "" }: { side: "yes" | "no"; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        side === "yes" ? "bg-yes-soft text-yes-strong" : "bg-no-soft text-no-strong"
      } ${className}`}
    >
      {side === "yes" ? <CheckIcon className="h-2.5 w-2.5" /> : <XIcon className="h-2.5 w-2.5" />}
      {side}
    </span>
  );
}
