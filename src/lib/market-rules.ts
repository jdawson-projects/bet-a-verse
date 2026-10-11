// Client-side mirror of the markets table constraints, for live validation.
export const QUESTION_MAX = 120;
export const QUESTION_MIN = 8;
export const DETAILS_MAX = 1000;
export const MIN_CLOSE_MS = 10 * 60 * 1000;

export interface QuestionCheck {
  ok: boolean;
  error: string | null;
  hint: string | null;
}

export function checkQuestion(raw: string): QuestionCheck {
  const q = raw.trim();
  if (q.length === 0) return { ok: false, error: null, hint: null };
  if (q.length > QUESTION_MAX) return { ok: false, error: `Keep it under ${QUESTION_MAX} characters`, hint: null };
  if (q.length < QUESTION_MIN) return { ok: false, error: "A bit longer, please", hint: null };
  if (!q.endsWith("?")) return { ok: false, error: "Questions end with a ?", hint: null };
  const hint = /^(will|does|is|can)\b/i.test(q)
    ? null
    : "Tip: yes/no questions usually start with Will, Does, Is or Can.";
  return { ok: true, error: null, hint };
}

export type ClosePick = "1h" | "tonight" | "24h" | "3d" | "1w" | "custom";

export const CLOSE_PICKS: { id: ClosePick; label: string }[] = [
  { id: "1h", label: "1 hour" },
  { id: "tonight", label: "Tonight 11:59 pm" },
  { id: "24h", label: "24 hours" },
  { id: "3d", label: "3 days" },
  { id: "1w", label: "1 week" },
  { id: "custom", label: "Custom" },
];

/** Resolve a quick pick to a Date (local time for "tonight"). Null for custom. */
export function closeFromPick(pick: ClosePick, now: Date): Date | null {
  const h = 3_600_000;
  switch (pick) {
    case "1h":
      return new Date(now.getTime() + h);
    case "tonight": {
      const d = new Date(now);
      d.setHours(23, 59, 0, 0);
      return d;
    }
    case "24h":
      return new Date(now.getTime() + 24 * h);
    case "3d":
      return new Date(now.getTime() + 72 * h);
    case "1w":
      return new Date(now.getTime() + 168 * h);
    case "custom":
      return null;
  }
}

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
