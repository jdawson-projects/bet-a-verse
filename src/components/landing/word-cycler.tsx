"use client";

import { useEffect, useState } from "react";

/** Rolls through phrases one line at a time, like a split-flap board. */
export function WordCycler({ words, interval = 2100, className = "" }: { words: readonly string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), interval);
    return () => clearInterval(t);
  }, [interval]);
  const idx = i % words.length;
  return (
    <span className={`relative inline-block overflow-hidden align-bottom ${className}`} style={{ height: "1.25em" }}>
      <span className="sr-only">{words.join(", ")}</span>
      <span
        aria-hidden
        className="block transition-transform duration-500 ease-[cubic-bezier(.2,.9,.3,1)] motion-reduce:transition-none"
        style={{ transform: `translateY(-${idx * 1.25}em)` }}
      >
        {words.map((w) => (
          <span key={w} className="block h-[1.25em] whitespace-nowrap leading-[1.25em]">
            {w}
          </span>
        ))}
      </span>
    </span>
  );
}
