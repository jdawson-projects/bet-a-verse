// The spec's required money cases, run against the real SQL functions.
import { describe, expect, it } from "vitest";
import { settlePool, type PoolBet } from "@/lib/money";
import { expectCode, withDb, type TestDb } from "./harness";

/** 3 YES bets of 5 and 2 NO bets of 10 from five different users. */
async function specPool(db: TestDb) {
  const creator = await db.createUser();
  const marketId = await db.createMarket(creator);
  const yes = [await db.createUser(), await db.createUser(), await db.createUser()];
  const no = [await db.createUser(), await db.createUser()];
  const yesBets = [];
  for (const u of yes) yesBets.push((await db.placeBet(u, marketId, "yes", 5)).bet_id);
  const noBets = [];
  for (const u of no) noBets.push((await db.placeBet(u, marketId, "no", 10)).bet_id);
  const mod = await db.createUser({ role: "moderator" });
  return { marketId, yes, no, yesBets, noBets, mod };
}

describe("resolve_market settlement (rake 5%)", () => {
  it("YES wins: 3×5 YES vs 2×10 NO → total 35, house 1, distributable 34, each YES payout 11, dust 1", () =>
    withDb(async (db) => {
      const { marketId, yes, no, yesBets, noBets, mod } = await specPool(db);
      await db.resolve(mod, marketId, "yes");

      const [s] = await db.sql(`select * from public.market_settlements where market_id = $1`, [marketId]);
      expect(s).toMatchObject({ kind: "settled", outcome: "yes", total: 35, house_take: 1, distributable: 34, paid_out: 33, dust: 1 });

      for (const id of yesBets) expect(await db.bet(id)).toMatchObject({ status: "won", payout: 11 });
      for (const id of noBets) expect(await db.bet(id)).toMatchObject({ status: "lost", payout: 0 });
      for (const u of yes) expect(await db.balance(u)).toBe(1000 - 5 + 11);
      for (const u of no) expect(await db.balance(u)).toBe(1000 - 10);

      const [m] = await db.sql(`select status, outcome from public.markets where id = $1`, [marketId]);
      expect(m).toEqual({ status: "resolved", outcome: "yes" });
      expect(await db.invariantViolations()).toEqual([]);
    }));

  it("NO wins: same bets → each NO payout 17, paid 34, dust 0", () =>
    withDb(async (db) => {
      const { marketId, yes, no, yesBets, noBets, mod } = await specPool(db);
      await db.resolve(mod, marketId, "no");

      const [s] = await db.sql(`select * from public.market_settlements where market_id = $1`, [marketId]);
      expect(s).toMatchObject({ total: 35, house_take: 1, distributable: 34, paid_out: 34, dust: 0 });
      for (const id of noBets) expect(await db.bet(id)).toMatchObject({ status: "won", payout: 17 });
      for (const id of yesBets) expect(await db.bet(id)).toMatchObject({ status: "lost", payout: 0 });
      for (const u of no) expect(await db.balance(u)).toBe(1000 - 10 + 17);
      for (const u of yes) expect(await db.balance(u)).toBe(1000 - 5);
    }));

  it.each(["yes", "no"] as const)("one-sided pool: 4 YES bets, 0 NO, outcome %s → every bet refunded in full, pool refunded, house 0", (outcome) =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const mod = await db.createUser({ role: "moderator" });
      const users = [await db.createUser(), await db.createUser(), await db.createUser(), await db.createUser()];
      const stakes = [1, 5, 10, 25];
      const bets = [];
      for (let i = 0; i < 4; i++) bets.push((await db.placeBet(users[i], marketId, "yes", stakes[i])).bet_id);

      await db.resolve(mod, marketId, outcome);

      for (let i = 0; i < 4; i++) {
        expect(await db.bet(bets[i])).toMatchObject({ status: "refunded", payout: stakes[i] });
        expect(await db.balance(users[i])).toBe(1000);
      }
      const [pool] = await db.sql(`select status from public.pools where market_id = $1`, [marketId]);
      expect(pool.status).toBe("refunded");
      const [s] = await db.sql(`select * from public.market_settlements where market_id = $1`, [marketId]);
      expect(s).toMatchObject({ kind: "refunded", total: 41, house_take: 0, paid_out: 41, dust: 0 });
      expect(await db.invariantViolations()).toEqual([]);
    }));

  it("SQL settlement matches the TypeScript settlePool for a random 40-bet pool", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator, { rakeBps: 700 });
      const mod = await db.createUser({ role: "moderator" });
      const stakes = [1, 5, 10, 25];
      const bets: PoolBet[] = [];
      let seed = 7;
      const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
      for (let i = 0; i < 40; i++) {
        const u = await db.createUser();
        const side = rand() < 0.4 ? "yes" : "no";
        const stake = stakes[Math.floor(rand() * 4)];
        const row = await db.placeBet(u, marketId, side, stake);
        bets.push({ id: row.bet_id, side, stake });
      }
      await db.resolve(mod, marketId, "yes");
      const expected = settlePool(bets, "yes", 700);

      const [s] = await db.sql(`select * from public.market_settlements where market_id = $1`, [marketId]);
      expect(s).toMatchObject({
        total: expected.total,
        house_take: expected.houseTake,
        distributable: expected.distributable,
        paid_out: expected.paidOut,
        dust: expected.dust,
      });
      for (const bet of bets) expect((await db.bet(bet.id)).payout).toBe(expected.payouts[bet.id]);
    }));
});

describe("void_market", () => {
  it("void: any bets, then void_market → every bet refunded, market voided", () =>
    withDb(async (db) => {
      const { marketId, yes, no, yesBets, noBets, mod } = await specPool(db);
      const before = await db.ledgerFingerprint();
      await db.void(mod, marketId);

      for (const id of [...yesBets, ...noBets]) expect((await db.bet(id)).status).toBe("refunded");
      for (const u of [...yes, ...no]) expect(await db.balance(u)).toBe(1000);
      const [m] = await db.sql(`select status, outcome from public.markets where id = $1`, [marketId]);
      expect(m).toEqual({ status: "voided", outcome: null });
      const after = await db.ledgerFingerprint();
      expect(after.rows - before.rows).toBe(5);
      expect(after.sum - before.sum).toBe(35);
    }));

  it("only moderators can void", () =>
    withDb(async (db) => {
      const { marketId, yes } = await specPool(db);
      await expectCode(db.void(yes[0], marketId), "not_allowed");
    }));
});

describe("place_bet validation", () => {
  it("over cap: stake 50 on a market with max_stake 25 → rejected", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator, { maxStake: 25 });
      const u = await db.createUser();
      await expectCode(db.placeBet(u, marketId, "yes", 50), "stake_over_max");
      expect(await db.balance(u)).toBe(1000);
    }));

  it("market max_stake 10 rejects a 25-coin bet", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator, { maxStake: 10 });
      const u = await db.createUser();
      await expectCode(db.placeBet(u, marketId, "no", 25), "stake_over_max");
    }));

  it("stakes outside 1/5/10/25 are rejected", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser();
      await expectCode(db.placeBet(u, marketId, "yes", 7), "invalid_stake");
      await expectCode(db.placeBet(u, marketId, "yes", 0), "invalid_stake");
    }));

  it("exposure cap: user already has 100 staked on the market, bets 5 more → rejected", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser();
      for (let i = 0; i < 4; i++) await db.placeBet(u, marketId, i % 2 ? "yes" : "no", 25);
      await expectCode(db.placeBet(u, marketId, "yes", 5), "exposure_cap");
      expect(await db.balance(u)).toBe(900);
    }));

  it("exposure cap counts both sides: 95 staked + 5 is allowed, then + 1 is rejected", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser();
      for (const s of [25, 25, 25, 10, 10]) await db.placeBet(u, marketId, "yes", s);
      await db.placeBet(u, marketId, "no", 5);
      await expectCode(db.placeBet(u, marketId, "no", 1), "exposure_cap");
    }));

  it("insufficient balance: balance 3, stake 5 → rejected", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser({ balance: 3 });
      expect(await db.balance(u)).toBe(3);
      await expectCode(db.placeBet(u, marketId, "yes", 5), "insufficient_balance");
      expect(await db.balance(u)).toBe(3);
      // 1 coin still works
      const row = await db.placeBet(u, marketId, "yes", 1);
      expect(row.balance).toBe(2);
    }));

  it("closed market: bets after closes_at are rejected", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser();
      await db.sql(`update public.markets set closes_at = now() - interval '1 second' where id = $1`, [marketId]);
      await expectCode(db.placeBet(u, marketId, "yes", 5), "market_closed");
      await db.sql(`select public.close_due_markets()`);
      const [m] = await db.sql(`select status from public.markets where id = $1`, [marketId]);
      expect(m.status).toBe("closed");
      await expectCode(db.placeBet(u, marketId, "yes", 5), "market_closed");
    }));

  it("banned users cannot bet", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser();
      await db.sql(`update public.profiles set banned_at = now() where id = $1`, [u]);
      await expectCode(db.placeBet(u, marketId, "yes", 5), "banned");
    }));

  it("a bet updates pool and market totals and returns the new price", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser();
      const row = await db.placeBet(u, marketId, "yes", 25);
      expect(row).toMatchObject({ balance: 975, yes_total: 25, no_total: 0, pool_yes_total: 25, pool_yes_bettors: 1 });
      expect(Number(row.price_at_bet)).toBe(0.5);
      expect(Number(row.implied_yes)).toBe(0.6);
      const [m] = await db.sql(`select bet_count from public.markets where id = $1`, [marketId]);
      expect(m.bet_count).toBe(1);
      const [swipe] = await db.sql(`select action from public.swipe_events where user_id = $1`, [u]);
      expect(swipe.action).toBe("yes");
    }));

  it("bets per minute are rate limited at 40", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const u = await db.createUser();
      for (let i = 0; i < 40; i++) {
        const m = await db.createMarket(creator);
        await db.placeBet(u, m, "yes", 1);
      }
      const m = await db.createMarket(creator);
      await expectCode(db.placeBet(u, m, "yes", 1), "rate_limited");
    }));
});

describe("cancel_bet (undo)", () => {
  it("undo window: cancel at 4 s refunds, cancel at 6 s is rejected", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser();

      const first = await db.placeBet(u, marketId, "yes", 10);
      await db.sql(`update public.bets set created_at = now() - interval '4 seconds' where id = $1`, [first.bet_id]);
      const cancelled = await db.cancelBet(u, first.bet_id);
      expect(cancelled.balance).toBe(1000);
      expect((await db.bet(first.bet_id)).status).toBe("cancelled");

      const second = await db.placeBet(u, marketId, "no", 10);
      await db.sql(`update public.bets set created_at = now() - interval '6 seconds' where id = $1`, [second.bet_id]);
      await expectCode(db.cancelBet(u, second.bet_id), "undo_window_expired");
      expect((await db.bet(second.bet_id)).status).toBe("active");
      expect(await db.balance(u)).toBe(990);

      const [m] = await db.sql(`select yes_total, no_total, bet_count from public.markets where id = $1`, [marketId]);
      expect(m).toEqual({ yes_total: 0, no_total: 10, bet_count: 1 });
      expect(await db.invariantViolations()).toEqual([]);
    }));

  it("you can't undo someone else's bet, or the same bet twice", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const marketId = await db.createMarket(creator);
      const u = await db.createUser();
      const other = await db.createUser();
      const bet = await db.placeBet(u, marketId, "yes", 5);
      await expectCode(db.cancelBet(other, bet.bet_id), "not_your_bet");
      await db.cancelBet(u, bet.bet_id);
      await expectCode(db.cancelBet(u, bet.bet_id), "bet_not_active");
    }));

  it("cancelled bets are left out of settlement", () =>
    withDb(async (db) => {
      const { marketId, mod } = await specPool(db);
      const late = await db.createUser();
      const bet = await db.placeBet(late, marketId, "no", 25);
      await db.cancelBet(late, bet.bet_id);
      await db.resolve(mod, marketId, "yes");
      const [s] = await db.sql(`select total from public.market_settlements where market_id = $1`, [marketId]);
      expect(s.total).toBe(35);
      expect((await db.bet(bet.bet_id)).status).toBe("cancelled");
      expect(await db.balance(late)).toBe(1000);
    }));
});

describe("resolution rules", () => {
  it("double resolve: second call errors and the ledger is unchanged", () =>
    withDb(async (db) => {
      const { marketId, mod } = await specPool(db);
      await db.resolve(mod, marketId, "yes");
      const before = await db.ledgerFingerprint();
      await expectCode(db.resolve(mod, marketId, "no"), "already_settled");
      await expectCode(db.resolve(mod, marketId, "yes"), "already_settled");
      await expectCode(db.void(mod, marketId), "already_settled");
      expect(await db.ledgerFingerprint()).toEqual(before);
    }));

  it("a creator with no bet can resolve their own market; with a bet they cannot", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const a = await db.createMarket(creator);
      const b = await db.createMarket(creator);
      const u = await db.createUser();
      await db.placeBet(u, a, "yes", 5);
      await db.placeBet(u, b, "yes", 5);
      await db.placeBet(creator, b, "no", 5);
      await db.resolve(creator, a, "yes");
      await expectCode(db.resolve(creator, b, "yes"), "not_allowed");
    }));

  it("a creator who cancelled their only bet can still resolve", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const m = await db.createMarket(creator);
      const bet = await db.placeBet(creator, m, "no", 5);
      await db.cancelBet(creator, bet.bet_id);
      await db.resolve(creator, m, "no");
    }));

  it("regular users cannot resolve other people's markets", () =>
    withDb(async (db) => {
      const { marketId, yes } = await specPool(db);
      await expectCode(db.resolve(yes[0], marketId, "yes"), "not_allowed");
    }));
});

describe("bonuses", () => {
  it("signup bonus: a new user has exactly one 1,000-coin signup_bonus ledger row", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const rows = await db.sql(`select amount, kind from public.ledger where user_id = $1`, [u]);
      expect(rows).toEqual([{ amount: 1000, kind: "signup_bonus" }]);
      expect(await db.balance(u)).toBe(1000);
    }));

  it("daily bonus: 100 coins once per UTC day", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const [r] = await db.as<{ claim_daily_bonus: number }>(u, `select public.claim_daily_bonus()`);
      expect(r.claim_daily_bonus).toBe(1100);
      await expectCode(db.as(u, `select public.claim_daily_bonus()`), "bonus_already_claimed");
      expect(await db.balance(u)).toBe(1100);
    }));
});

describe("balance invariant", () => {
  it("after a random sequence of bets, undos, resolves and voids: profiles.balance = sum(ledger.amount) for every user", () =>
    withDb(async (db) => {
      const users = [];
      for (let i = 0; i < 8; i++) users.push(await db.createUser({ balance: 60 + i * 20 }));
      const mod = await db.createUser({ role: "moderator" });
      const markets = [];
      for (let i = 0; i < 5; i++) markets.push(await db.createMarket(users[i]));
      const stakes = [1, 5, 10, 25];
      let seed = 99;
      const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
      const placed: { user: string; bet: string }[] = [];

      for (let step = 0; step < 120; step++) {
        const r = rand();
        const user = users[Math.floor(rand() * users.length)];
        const market = markets[Math.floor(rand() * markets.length)];
        try {
          if (r < 0.7) {
            const row = await db.placeBet(user, market, rand() < 0.5 ? "yes" : "no", stakes[Math.floor(rand() * 4)]);
            placed.push({ user, bet: row.bet_id });
          } else if (r < 0.85 && placed.length) {
            const p = placed[Math.floor(rand() * placed.length)];
            await db.cancelBet(p.user, p.bet);
          } else if (r < 0.95) {
            await db.resolve(mod, market, rand() < 0.5 ? "yes" : "no");
          } else {
            await db.void(mod, market);
          }
        } catch {
          // Expected rejections (caps, balance, already settled…) are part of the sequence.
        }
      }
      for (const m of markets) {
        try {
          await db.resolve(mod, m, "yes");
        } catch {
          // already settled
        }
      }
      expect(await db.invariantViolations()).toEqual([]);
      const [{ n }] = await db.sql<{ n: number }>(
        `select count(*)::int as n from public.bets where status = 'active' and market_id = any($1)`,
        [markets],
      );
      expect(n).toBe(0);
    }));
});
