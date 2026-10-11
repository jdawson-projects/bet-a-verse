// Pricing and settlement math, mirrored from the SQL money functions.
// The database is the source of truth for coins; this module powers the card
// display (implied price, estimated payout) and the settlement unit tests.
// All coin math is integer-only (BigInt for the multiply-divide step).

export type Side = "yes" | "no";

export const STAKE_OPTIONS = [1, 5, 10, 25] as const;
export type Stake = (typeof STAKE_OPTIONS)[number];

export const DEFAULT_STAKE: Stake = 5;
export const MAX_STAKE = 25;
export const MAX_EXPOSURE_PER_MARKET = 100;
export const DEFAULT_RAKE_BPS = 500;
export const VIRTUAL_LIQUIDITY = 50;
export const UNDO_WINDOW_MS = 5_000;
export const SIGNUP_BONUS = 1_000;
export const DAILY_BONUS = 100;

export function isStake(value: number): value is Stake {
  return (STAKE_OPTIONS as readonly number[]).includes(value);
}

/** floor(a * b / c) for non-negative integers, computed exactly. */
export function mulDivFloor(a: number, b: number, c: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c)) {
    throw new Error("mulDivFloor expects safe integers");
  }
  if (a < 0 || b < 0 || c <= 0) throw new Error("mulDivFloor expects a, b >= 0 and c > 0");
  return Number((BigInt(a) * BigInt(b)) / BigInt(c));
}

/** Implied YES probability: (yes + v) / (yes + no + 2v), v = 50 virtual coins per side. Display only. */
export function impliedYes(yesTotal: number, noTotal: number): number {
  return (yesTotal + VIRTUAL_LIQUIDITY) / (yesTotal + noTotal + 2 * VIRTUAL_LIQUIDITY);
}

/** "0.62" */
export function formatPrice(p: number): string {
  return p.toFixed(2);
}

export function houseTake(total: number, rakeBps: number): number {
  return mulDivFloor(total, rakeBps, 10_000);
}

/**
 * Estimated payout if `side` wins, as if `stake` were added to the current pots.
 * Returns null when the opposite pot is empty ("Be the first to call it").
 */
export function estimatePayout(args: {
  yesTotal: number;
  noTotal: number;
  side: Side;
  stake: number;
  rakeBps?: number;
}): number | null {
  const { yesTotal, noTotal, side, stake, rakeBps = DEFAULT_RAKE_BPS } = args;
  const opposite = side === "yes" ? noTotal : yesTotal;
  if (opposite === 0) return null;
  const sideTotal = (side === "yes" ? yesTotal : noTotal) + stake;
  const total = yesTotal + noTotal + stake;
  const distributable = total - houseTake(total, rakeBps);
  return mulDivFloor(stake, distributable, sideTotal);
}

/** Payout for a bet already in the pot (pot totals include the stake). */
export function payoutIfRight(args: {
  yesTotal: number;
  noTotal: number;
  side: Side;
  stake: number;
  rakeBps?: number;
}): number | null {
  const { yesTotal, noTotal, side, stake, rakeBps = DEFAULT_RAKE_BPS } = args;
  const sideTotal = side === "yes" ? yesTotal : noTotal;
  const opposite = side === "yes" ? noTotal : yesTotal;
  if (opposite === 0 || sideTotal === 0) return null;
  const total = yesTotal + noTotal;
  const distributable = total - houseTake(total, rakeBps);
  return mulDivFloor(stake, distributable, sideTotal);
}

export interface PoolBet {
  id: string;
  side: Side;
  stake: number;
}

export interface PoolSettlement {
  kind: "settled" | "refunded";
  total: number;
  houseTake: number;
  distributable: number;
  paidOut: number;
  dust: number;
  /** bet id → coins returned to the bettor (0 for a losing bet) */
  payouts: Record<string, number>;
  /** bet id → final status */
  statuses: Record<string, "won" | "lost" | "refunded">;
}

/**
 * Parimutuel settlement of one pool (active bets only):
 *   total = yes + no; house = floor(total * rake_bps / 10000); distributable = total - house
 *   winner payout = floor(stake * distributable / winning_total); loser payout = 0
 * If either side is empty, every bet is refunded in full with no rake.
 */
export function settlePool(bets: readonly PoolBet[], outcome: Side, rakeBps = DEFAULT_RAKE_BPS): PoolSettlement {
  let yes = 0;
  let no = 0;
  for (const bet of bets) {
    if (!Number.isSafeInteger(bet.stake) || bet.stake <= 0) throw new Error(`invalid stake on ${bet.id}`);
    if (bet.side === "yes") yes += bet.stake;
    else no += bet.stake;
  }
  const total = yes + no;
  const payouts: Record<string, number> = {};
  const statuses: PoolSettlement["statuses"] = {};

  if (yes === 0 || no === 0) {
    for (const bet of bets) {
      payouts[bet.id] = bet.stake;
      statuses[bet.id] = "refunded";
    }
    return { kind: "refunded", total, houseTake: 0, distributable: total, paidOut: total, dust: 0, payouts, statuses };
  }

  const house = houseTake(total, rakeBps);
  const distributable = total - house;
  const winningTotal = outcome === "yes" ? yes : no;
  let paidOut = 0;
  for (const bet of bets) {
    if (bet.side === outcome) {
      const payout = mulDivFloor(bet.stake, distributable, winningTotal);
      payouts[bet.id] = payout;
      statuses[bet.id] = "won";
      paidOut += payout;
    } else {
      payouts[bet.id] = 0;
      statuses[bet.id] = "lost";
    }
  }
  return {
    kind: "settled",
    total,
    houseTake: house,
    distributable,
    paidOut,
    dust: total - house - paidOut,
    payouts,
    statuses,
  };
}

/** Share of distinct bettors on YES, 0–100, or null with no bettors. */
export function yesShare(yesBettors: number, noBettors: number): number | null {
  const n = yesBettors + noBettors;
  return n === 0 ? null : Math.round((yesBettors / n) * 100);
}
