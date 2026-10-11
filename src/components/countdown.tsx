"use client";

import { useEffect, useState } from "react";
import { closesIn } from "@/lib/format";

/** Live "2h 14m" until `iso`. Renders the server's value first to avoid a hydration mismatch. */
export function Countdown({ iso, initialNow }: { iso: string; initialNow: number }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular">{closesIn(iso, now)}</span>;
}
