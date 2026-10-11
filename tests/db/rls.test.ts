// Row Level Security, grants, triggers and the feed.
import { describe, expect, it } from "vitest";
import { expectCode, expectDenied, withDb } from "./harness";

describe("money columns are function-only", () => {
  it("users cannot write their balance, role or ban state", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      await expectDenied(db.as(u, `update public.profiles set balance = 99999 where id = $1`, [u]));
      await expectDenied(db.as(u, `update public.profiles set role = 'admin' where id = $1`, [u]));
      await expectDenied(db.as(u, `update public.profiles set banned_at = null where id = $1`, [u]));
      await db.as(u, `update public.profiles set display_name = 'New name', default_stake = 10 where id = $1`, [u]);
      expect(await db.balance(u)).toBe(1000);
    }));

  it("users cannot edit someone else's profile (RLS filters the row)", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const other = await db.createUser();
      await db.as(u, `update public.profiles set display_name = 'hacked' where id = $1`, [other]);
      const [row] = await db.sql(`select display_name from public.profiles where id = $1`, [other]);
      expect(row.display_name).toBeNull();
    }));

  it("even the database owner cannot change a balance outside post_ledger", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      await expectCode(db.sql(`update public.profiles set balance = 5 where id = $1`, [u]), "balance_write_forbidden");
    }));

  it("the ledger is append-only, even for the owner", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      await expectCode(db.sql(`update public.ledger set amount = 5000 where user_id = $1`, [u]), "ledger_append_only");
      await expectDenied(db.as(u, `delete from public.ledger where user_id = $1`, [u]));
    }));

  it("users cannot insert bets, ledger rows or settlements, or touch market totals", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const m = await db.createMarket(u);
      const [pool] = await db.sql<{ id: string }>(`select id from public.pools where market_id = $1`, [m]);
      await expectDenied(
        db.as(u, `insert into public.bets (market_id, pool_id, user_id, side, stake, price_at_bet) values ($1, $2, $3, 'yes', 5, 0.5)`, [m, pool.id, u]),
      );
      await expectDenied(db.as(u, `insert into public.ledger (user_id, amount, kind) values ($1, 1000000, 'adjustment')`, [u]));
      await expectDenied(db.as(u, `update public.markets set yes_total = 1000 where id = $1`, [m]));
      await expectDenied(db.as(u, `update public.markets set status = 'resolved', outcome = 'yes' where id = $1`, [m]));
      await expectDenied(db.as(u, `update public.pools set yes_total = 1000 where market_id = $1`, [m]));
    }));

  it("post_ledger and close_due_markets are not callable through the API", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      await expectDenied(db.as(u, `select public.post_ledger($1, 1000000, 'adjustment', null, null)`, [u]));
      await expectDenied(db.as(u, `select public.close_due_markets()`));
    }));

  it("ledger rows and swipe events are private to their owner", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const other = await db.createUser();
      const m = await db.createMarket(other);
      await db.placeBet(other, m, "yes", 5);
      expect(await db.as(u, `select * from public.ledger where user_id = $1`, [other])).toEqual([]);
      expect(await db.as(u, `select * from public.swipe_events where user_id = $1`, [other])).toEqual([]);
      // bets themselves are public
      expect(await db.as(u, `select id from public.bets where user_id = $1`, [other])).toHaveLength(1);
    }));

  it("signed-out (anon) requests read nothing", () =>
    withDb(async (db) => {
      await expectDenied(db.sql(`set local role anon; select * from public.markets`));
    }));
});

describe("market creation", () => {
  const insert = `insert into public.markets (question, details, category, closes_at, resolves_by)
                  values ($1, '', 'campus', now() + make_interval(mins => $2), now() + make_interval(mins => $2) + interval '1 day')
                  returning id, creator_id, status`;

  it("a user creates a market: creator is them, status open, pool 0 exists", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const [m] = await db.as<{ id: string; creator_id: string; status: string }>(u, insert, ["Will the Reg be packed tonight?", 60]);
      expect(m.creator_id).toBe(u);
      expect(m.status).toBe("open");
      const pools = await db.sql(`select index from public.pools where market_id = $1`, [m.id]);
      expect(pools).toEqual([{ index: 0 }]);
    }));

  it("closes_at must be at least 10 minutes out", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      await expectCode(db.as(u, insert, ["Will the Reg be packed tonight?", 5]), "closes_too_soon");
    }));

  it("questions must end in ? and be at most 120 chars", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      await expect(db.as(u, insert, ["Will the Reg be packed tonight", 60])).rejects.toMatchObject({ sqlState: "23514" });
      await expect(db.as(u, insert, [`Will ${"x".repeat(120)}?`, 60])).rejects.toMatchObject({ sqlState: "23514" });
    }));

  it("users cannot set status, totals, rake or creator on insert", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const other = await db.createUser();
      await expectDenied(
        db.as(u, `insert into public.markets (question, closes_at, resolves_by, status) values ('Will this work?', now() + interval '1 hour', now() + interval '2 hours', 'resolved')`),
      );
      await expectDenied(
        db.as(u, `insert into public.markets (question, closes_at, resolves_by, creator_id) values ('Will this work?', now() + interval '1 hour', now() + interval '2 hours', $1)`, [other]),
      );
    }));

  it("community markets require membership", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const [c] = await db.sql<{ id: string }>(
        `insert into public.communities (slug, name, kind) values ('test-comm', 'Test', 'topic') returning id`,
      );
      const q = `insert into public.markets (question, community_id, closes_at, resolves_by)
                 values ('Will members post?', $1, now() + interval '1 hour', now() + interval '2 hours') returning id`;
      await expectDenied(db.as(u, q, [c.id]));
      await db.as(u, `insert into public.community_members (community_id) values ($1)`, [c.id]);
      const [{ member_count }] = await db.sql(`select member_count from public.communities where id = $1`, [c.id]);
      expect(member_count).toBe(1);
      await db.as(u, q, [c.id]);
    }));

  it("market creation is rate limited at 3 per minute", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      for (let i = 0; i < 3; i++) await db.as(u, insert, [`Will test ${i} pass?`, 60]);
      await expectCode(db.as(u, insert, ["Will test 4 pass?", 60]), "rate_limited");
    }));
});

describe("comments and likes", () => {
  it("comment counts follow inserts and soft deletes; replies flatten to one level", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const other = await db.createUser();
      const m = await db.createMarket(u);
      const [c1] = await db.as<{ id: string }>(u, `insert into public.comments (market_id, body) values ($1, '  YES all day  ') returning id, body`, [m]);
      const [c2] = await db.as<{ id: string }>(other, `insert into public.comments (market_id, parent_id, body) values ($1, $2, 'no way') returning id`, [m, c1.id]);
      const [c3] = await db.as<{ id: string; parent_id: string }>(
        u,
        `insert into public.comments (market_id, parent_id, body) values ($1, $2, 'watch me') returning id, parent_id`,
        [m, c2.id],
      );
      expect(c3.parent_id).toBe(c1.id);
      const [body] = await db.sql(`select body from public.comments where id = $1`, [c1.id]);
      expect(body.body).toBe("YES all day");
      let [mk] = await db.sql(`select comment_count from public.markets where id = $1`, [m]);
      expect(mk.comment_count).toBe(3);

      await expectCode(db.as(other, `select public.delete_comment($1)`, [c1.id]), "not_allowed");
      await db.as(other, `select public.delete_comment($1)`, [c2.id]);
      [mk] = await db.sql(`select comment_count from public.markets where id = $1`, [m]);
      expect(mk.comment_count).toBe(2);

      const mod = await db.createUser({ role: "moderator" });
      await db.as(mod, `select public.delete_comment($1)`, [c1.id]);
      [mk] = await db.sql(`select comment_count from public.markets where id = $1`, [m]);
      expect(mk.comment_count).toBe(1);
    }));

  it("comments are rate limited at 6 per minute and blocked for banned users", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const m = await db.createMarket(u);
      for (let i = 0; i < 6; i++) await db.as(u, `insert into public.comments (market_id, body) values ($1, $2)`, [m, `msg ${i}`]);
      await expectCode(db.as(u, `insert into public.comments (market_id, body) values ($1, 'one more')`, [m]), "rate_limited");
      const banned = await db.createUser();
      await db.sql(`update public.profiles set banned_at = now() where id = $1`, [banned]);
      await expectDenied(db.as(banned, `insert into public.comments (market_id, body) values ($1, 'hi')`, [m]));
    }));

  it("like counts follow likes and unlikes", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const m = await db.createMarket(u);
      await db.as(u, `insert into public.market_likes (market_id) values ($1)`, [m]);
      let [mk] = await db.sql(`select like_count from public.markets where id = $1`, [m]);
      expect(mk.like_count).toBe(1);
      await db.as(u, `delete from public.market_likes where market_id = $1`, [m]);
      [mk] = await db.sql(`select like_count from public.markets where id = $1`, [m]);
      expect(mk.like_count).toBe(0);
    }));
});

describe("get_feed", () => {
  it("hides markets you bet on, skipped (7 days), excluded, closed, or by banned creators", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const banned = await db.createUser();
      const u = await db.createUser();
      const bet = await db.createMarket(creator);
      const skipped = await db.createMarket(creator);
      const excluded = await db.createMarket(creator);
      const closed = await db.createMarket(creator);
      const byBanned = await db.createMarket(banned);
      const visible = await db.createMarket(creator);
      await db.sql(`update public.profiles set banned_at = now() where id = $1`, [banned]);
      await db.sql(`update public.markets set status = 'closed' where id = $1`, [closed]);
      await db.placeBet(u, bet, "yes", 5);
      await db.as(u, `insert into public.swipe_events (market_id, action, dwell_ms) values ($1, 'skip', 800)`, [skipped]);

      const ours = [bet, skipped, excluded, closed, byBanned, visible];
      const feed = await db.feed(u, ours, [excluded]);
      expect(feed.map((r) => r.id)).toEqual([visible]);
    }));

  it("a skipped market returns after 7 days, once", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const u = await db.createUser();
      const m = await db.createMarket(creator, { closesInMinutes: 60 * 24 * 30 });
      const skip = `insert into public.swipe_events (market_id, action) values ($1, 'skip') returning id`;
      const [s1] = await db.as<{ id: string }>(u, skip, [m]);
      await db.sql(`update public.swipe_events set created_at = now() - interval '8 days' where id = $1`, [s1.id]);
      let feed = await db.feed(u, [m]);
      expect(feed.some((r) => r.id === m)).toBe(true);
      const [s2] = await db.as<{ id: string }>(u, skip, [m]);
      await db.sql(`update public.swipe_events set created_at = now() - interval '8 days' where id = $1`, [s2.id]);
      feed = await db.feed(u, [m]);
      expect(feed.some((r) => r.id === m)).toBe(false);
    }));

  it("users may record skips but not yes/no swipes directly", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const m = await db.createMarket(u);
      await expectDenied(db.as(u, `insert into public.swipe_events (market_id, action) values ($1, 'yes')`, [m]));
    }));

  it("featured and closing-soon markets rank above plain ones", () =>
    withDb(async (db) => {
      const creator = await db.createUser();
      const u = await db.createUser();
      const plain = await db.createMarket(creator, { closesInMinutes: 60 * 24 * 5 });
      const featured = await db.createMarket(creator, { closesInMinutes: 60 * 24 * 5 });
      await db.sql(`update public.markets set featured_at = now() where id = $1`, [featured]);
      const feed = await db.feed(u, [plain, featured]);
      const score = (id: string) => feed.find((r) => r.id === id)!.score;
      expect(score(featured)).toBeGreaterThan(score(plain) + 3);
    }));
});

describe("profile stats", () => {
  it("record, win rate and streaks: W W L W W W → 5–1, current 3, best 3", () =>
    withDb(async (db) => {
      const u = await db.createUser();
      const counter = await db.createUser();
      const mod = await db.createUser({ role: "moderator" });
      const results = ["won", "won", "lost", "won", "won", "won"];
      for (const r of results) {
        const m = await db.createMarket(mod);
        await db.placeBet(u, m, "yes", 5);
        await db.placeBet(counter, m, "no", 5);
        await db.resolve(mod, m, r === "won" ? "yes" : "no");
        await db.sql(`update public.bets set settled_at = clock_timestamp() where market_id = $1`, [m]);
      }
      const [s] = await db.as(u, `select * from public.get_profile_stats($1)`, [u]);
      expect(s).toMatchObject({ wins: 5, losses: 1, current_streak: 3, best_streak: 3 });
      expect(Number(s.win_rate)).toBeCloseTo(5 / 6, 3);
    }));
});
