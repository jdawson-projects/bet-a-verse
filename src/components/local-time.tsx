"use client";

import { formatDateTime, SERVER_TIME_ZONE } from "@/lib/format";
import { useMounted } from "@/lib/use-mounted";

/** A timestamp in the viewer's timezone (the launch campus's timezone until hydration). */
export function LocalTime({ iso }: { iso: string }) {
  const mounted = useMounted();
  return <time dateTime={iso}>{formatDateTime(iso, mounted ? undefined : SERVER_TIME_ZONE)}</time>;
}
