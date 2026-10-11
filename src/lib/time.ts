import { UNDO_WINDOW_MS } from "./money";

/** Wall-clock read, kept out of component bodies so render stays pure. */
export function nowMs(): number {
  return Date.now();
}

/**
 * How long the Undo toast may stay up for a bet committed at `startedAt`.
 * The server's 5-second window starts when the bet row is written, so leave
 * a margin for the round trip. Returns 0 when it's not worth showing.
 */
export function undoToastMs(startedAt: number): number {
  const remaining = UNDO_WINDOW_MS - (nowMs() - startedAt) - 400;
  return remaining > 800 ? remaining : 0;
}
