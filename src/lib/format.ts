const coinFormat = new Intl.NumberFormat("en-US");

export function formatCoins(n: number): string {
  return coinFormat.format(n);
}

/** Compact duration until `iso`: "45s", "12m", "2h 14m", "3d 4h", or "closed". */
export function closesIn(iso: string, now: number = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "closed";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** "now", "5m", "3h", "2d", or a short date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: SERVER_TIME_ZONE });
}

/** Server renders use the launch campus's timezone; the client switches to the viewer's after hydration. */
export const SERVER_TIME_ZONE = "America/Chicago";

export function formatDateTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${formatCoins(n)} ${n === 1 ? one : many}`;
}

export const CATEGORY_LABELS = {
  sports: "Sports",
  campus: "Campus",
  culture: "Culture",
  crypto: "Crypto",
  news: "News",
  other: "Other",
} as const;
