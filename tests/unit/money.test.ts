import { describe, expect, it } from "vitest";
import {
  estimatePayout,
  formatPrice,
  impliedYes,
  mulDivFloor,
  payoutIfRight,
  settlePool,
  yesShare,
  type PoolBet,
} from "@/lib/money";

const specBets: PoolBet[] = [
  { id: "y1", side: "yes", stake: 5 },
  { id: "y2", side: "yes", stake: 5 },
  { id: "y3", side: "yes", stake: 5 },
  { id: "n1", side: "no", stake: 10 },
  { id: "n2", side: "no", stake: 10 },
];

describe("settlePool (spec cases, rake 5%)", () => {
  it("YES wins: 3×5 YES vs 2×10 NO → total 35, house 1, distributable 34, each YES gets 11, dust 1", () => {
    const s = settlePool(specBets, "yes", 500);
    expect(s.kind).toBe("settled");
    expect(s.total).toBe(35);
    expect(s.houseTake).toBe(1);
    expect(s.distributable).toBe(34);
    expect([s.payouts.y1, s.payouts.y2, s.payouts.y3]).toEqual([11, 11, 11]);
    expect([s.payouts.n1, s.payouts.n2]).toEqual([0, 0]);
    expect(s.paidOut).toBe(33);
    expect(s.dust).toBe(1);
    expect(s.houseTake + s.paidOut + s.dust).toBe(s.total);
  });

  it("NO wins: same bets → each NO gets 17, paid 34, dust 0", () => {
    const s = settlePool(specBets, "no", 500);
    expect(s.total).toBe(35);
    expect(s.houseTake).toBe(1);
    expect([s.payouts.n1, s.payouts.n2]).toEqual([17, 17]);
    expect([s.payouts.y1, s.payouts.y2, s.payouts.y3]).toEqual([0, 0, 0]);
    expect(s.statuses.y1).toBe("lost");
    expect(s.paidOut).toBe(34);
    expect(s.dust).toBe(0);
  });

  it.each(["yes", "no"] as const)("one-sided pool: 4 YES bets, 0 NO, outcome %s → all refunded in full, house 0", (outcome) => {
    const bets: PoolBet[] = [5, 10, 25, 1].map((stake, i) => ({ id: `y${i}`, side: "yes", stake }));
    const s = settlePool(bets, outcome, 500);
    expect(s.kind).toBe("refunded");
    expect(s.houseTake).toBe(0);
    expect(s.paidOut).toBe(41);
    expect(s.dust).toBe(0);
    for (const bet of bets) {
      expect(s.payouts[bet.id]).toBe(bet.stake);
      expect(s.statuses[bet.id]).toBe("refunded");
    }
  });

  it("empty pool refunds nothing: total 0, house 0", () => {
    const s = settlePool([], "yes");
    expect(s).toMatchObject({ kind: "refunded", total: 0, houseTake: 0, paidOut: 0, dust: 0 });
  });

  it("a 1-coin winner can floor to 0: YES 101 (4×25 + 1) vs NO 1 → house 5, distributable 97, floor(1×97/101) = 0", () => {
    const bets: PoolBet[] = [
      ...Array.from({ length: 4 }, (_, i) => ({ id: `w${i}`, side: "yes" as const, stake: 25 })),
      { id: "small", side: "yes", stake: 1 },
      { id: "l", side: "no", stake: 1 },
    ];
    // yes 101, no 1, total 102, house 5, distributable 97
    const s = settlePool(bets, "yes", 500);
    expect(s.houseTake).toBe(5);
    expect(s.distributable).toBe(97);
    expect(s.payouts.small).toBe(0);
    expect(s.payouts.w0).toBe(24); // floor(25 × 97 / 101) = 24
    expect(s.houseTake + s.paidOut + s.dust).toBe(102);
  });

  it("never pays out more than the distributable pot (randomized)", () => {
    const stakes = [1, 5, 10, 25];
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let round = 0; round < 500; round++) {
      const n = 1 + Math.floor(rand() * 30);
      const bets: PoolBet[] = Array.from({ length: n }, (_, i) => ({
        id: String(i),
        side: rand() < 0.5 ? "yes" : "no",
        stake: stakes[Math.floor(rand() * 4)],
      }));
      const s = settlePool(bets, rand() < 0.5 ? "yes" : "no", 500);
      expect(s.paidOut).toBeLessThanOrEqual(s.distributable);
      expect(s.houseTake + s.paidOut + s.dust).toBe(s.total);
      expect(s.dust).toBeGreaterThanOrEqual(0);
      if (s.kind === "settled") expect(s.dust).toBeLessThan(n);
    }
  });
});

describe("pricing", () => {
  it("fresh market reads 0.50 (50 virtual coins per side)", () => {
    expect(impliedYes(0, 0)).toBe(0.5);
    expect(formatPrice(impliedYes(0, 0))).toBe("0.50");
  });

  it("one 25-coin YES bet moves a fresh market to 0.60, not 1.00", () => {
    expect(formatPrice(impliedYes(25, 0))).toBe("0.60");
  });

  it("YES 60 / NO 20 reads YES 0.61 · NO 0.39", () => {
    const p = impliedYes(60, 20); // 110 / 180
    expect(formatPrice(p)).toBe("0.61");
    expect(formatPrice(1 - p)).toBe("0.39");
  });
});

describe("estimatePayout", () => {
  it("5 on YES into YES 15 / NO 20 → ~9 coins (total 40, house 2, 5×38/20 = 9)", () => {
    expect(estimatePayout({ yesTotal: 15, noTotal: 20, side: "yes", stake: 5 })).toBe(9);
  });

  it("returns null when the opposite pot is 0 (Be the first to call it)", () => {
    expect(estimatePayout({ yesTotal: 40, noTotal: 0, side: "yes", stake: 5 })).toBeNull();
    expect(estimatePayout({ yesTotal: 0, noTotal: 0, side: "no", stake: 5 })).toBeNull();
  });

  it("betting the empty side gets an estimate: 10 on NO into YES 40 / NO 0 → total 50, house 2, 10×48/10 = 48", () => {
    expect(estimatePayout({ yesTotal: 40, noTotal: 0, side: "no", stake: 10 })).toBe(48);
  });

  it("payoutIfRight matches settlement for a bet already in the pot", () => {
    // YES 15 (incl. my 5) / NO 20 → 5 × 34 / 15 = 11, same as the settlement case
    expect(payoutIfRight({ yesTotal: 15, noTotal: 20, side: "yes", stake: 5 })).toBe(11);
  });
});

describe("helpers", () => {
  it("mulDivFloor is exact for large values", () => {
    expect(mulDivFloor(9_007_199, 1_000_000, 3)).toBe(3_002_399_666_666);
  });

  it("yesShare rounds to whole percent", () => {
    expect(yesShare(2, 1)).toBe(67);
    expect(yesShare(0, 0)).toBeNull();
  });
});
