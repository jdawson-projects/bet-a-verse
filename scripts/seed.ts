// pnpm seed        → wipe previous seed data, then fill the feed for day one
// pnpm seed:reset  → only wipe seed data
//
// Every seeded row is flagged: profiles/markets/communities/comments carry
// meta.seed = true, and seeded auth users use the @seed.betaverse.local domain.
// Coins only move through the real SQL functions (place_bet, resolve_market,
// void_market), so the ledger invariant holds for seeded and real users alike.
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";
import { COMMENT_LINES, COMMUNITIES, HOUSE, OPEN_MARKETS, RESOLVED_MARKETS, USERS, type SeedMarket } from "./seed-data";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const SEED_EMAIL_DOMAIN = "seed.betaverse.local";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run `pnpm env:local` (local) or export it (cloud).");
  process.exit(1);
}

// Small deterministic PRNG so seeds are reproducible.
let state = 20261011;
const rand = () => {
  state = (state * 48271) % 2147483647;
  return state / 2147483647;
};
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const STAKES = [1, 5, 5, 5, 10, 10, 25] as const;

const db = new Client({ connectionString: DATABASE_URL });

async function q<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []) {
  return (await db.query<T>(text, params)).rows;
}

/** Run a statement as a signed-in user (role authenticated + JWT sub), like PostgREST does. */
async function asUser<T extends Record<string, unknown> = Record<string, unknown>>(
  userId: string,
  text: string,
  params: unknown[] = [],
) {
  await q(`select set_config('request.jwt.claims', $1, true), set_config('role', 'authenticated', true)`, [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  // On error the whole seed transaction rolls back, so no cleanup is needed on that path.
  const rows = await q<T>(text, params);
  await q(`select set_config('request.jwt.claims', '', true), set_config('role', 'postgres', true)`);
  return rows;
}

async function wipe() {
  await q(`select set_config('bav.seeding', 'on', true)`);
  // Refund everyone (including real users) on seeded markets that are still live.
  const live = await q<{ id: string }>(
    `select id from public.markets where meta ->> 'seed' = 'true' and status in ('open', 'closed')`,
  );
  for (const m of live) await q(`select public.void_market($1, 'Seed data reset')`, [m.id]);
  const markets = await q(`delete from public.markets where meta ->> 'seed' = 'true' returning id`);
  const users = await q(`delete from auth.users where email like $1 returning id`, [`%@${SEED_EMAIL_DOMAIN}`]);
  const communities = await q(`delete from public.communities where meta ->> 'seed' = 'true' returning id`);
  console.log(
    `Wiped seed data: ${markets.length} markets, ${users.length} users, ${communities.length} communities (refunded ${live.length} live markets).`,
  );
}

async function createUser(u: { username: string; displayName: string; bio: string }, role = "user") {
  const id = randomUUID();
  await q(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                             raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                             confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(),
             '{"provider":"email","providers":["email"],"seed":"true"}', $3, now() - interval '20 days', now(),
             '', '', '', '')`,
    [id, `${u.username}@${SEED_EMAIL_DOMAIN}`, JSON.stringify({ full_name: u.displayName })],
  );
  await q(
    `update public.profiles set username = $2, display_name = $3, bio = $4, role = $5::public.user_role,
            created_at = now() - interval '20 days'
     where id = $1`,
    [id, u.username, u.displayName, u.bio, role],
  );
  return id;
}

async function insertMarket(m: SeedMarket, creatorId: string, communityId: string | null, closesInHours: number) {
  const [row] = await q<{ id: string }>(
    `insert into public.markets (question, details, category, community_id, creator_id, closes_at, resolves_by,
                                 featured_at, meta, created_at)
     values ($1, $2, $3, $4, $5, now() + make_interval(hours => $6), now() + make_interval(hours => $6 + 24),
             case when $7 then now() end, '{"seed": true}', now() - make_interval(hours => $8))
     returning id`,
    [m.question, m.details, m.category, communityId, creatorId, closesInHours, m.featured ?? false, 2 + Math.floor(rand() * 60)],
  );
  return row.id;
}

/** Each user bets with probability `participation`, on the side drawn from the market's lean. */
async function placeBets(marketId: string, lean: number, userIds: string[], participation: number) {
  const bets: string[] = [];
  for (const userId of userIds) {
    if (rand() > participation) continue;
    const side = rand() < lean ? "yes" : "no";
    const [bet] = await asUser<{ bet_id: string }>(userId, `select bet_id from public.place_bet($1, $2, $3, $4)`, [
      marketId,
      side,
      pick(STAKES),
      800 + Math.floor(rand() * 4000),
    ]);
    bets.push(bet.bet_id);
  }
  return bets;
}

async function addComments(marketId: string, userIds: string[], count: number) {
  const top: string[] = [];
  for (let i = 0; i < count; i++) {
    const userId = pick(userIds);
    const [bet] = await q<{ side: "yes" | "no" }>(
      `select side from public.bets where market_id = $1 and user_id = $2 and status <> 'cancelled' limit 1`,
      [marketId, userId],
    );
    const replyTo = top.length && rand() < 0.3 ? pick(top) : null;
    const body = replyTo ? pick(COMMENT_LINES.replies) : pick(bet ? COMMENT_LINES[bet.side] : COMMENT_LINES.neutral);
    const [c] = await asUser<{ id: string }>(
      userId,
      `insert into public.comments (market_id, parent_id, body) values ($1, $2, $3) returning id`,
      [marketId, replyTo, body],
    );
    await q(`update public.comments set meta = '{"seed": true}', created_at = now() - make_interval(mins => $2) where id = $1`, [
      c.id,
      Math.floor(rand() * 600),
    ]);
    if (!replyTo) top.push(c.id);
    // A few likes on each comment
    for (const liker of userIds) {
      if (liker !== userId && rand() < 0.15) {
        await asUser(liker, `insert into public.comment_likes (comment_id) values ($1)`, [c.id]);
      }
    }
  }
}

async function seed() {
  await q(`select set_config('bav.seeding', 'on', true)`);

  const houseId = await createUser(HOUSE, "admin");
  const userIds: string[] = [];
  const byUsername = new Map<string, string>();
  for (const u of USERS) {
    const id = await createUser(u);
    userIds.push(id);
    byUsername.set(u.username, id);
  }

  const communityIds = new Map<string, string>();
  for (const c of COMMUNITIES) {
    const [row] = await q<{ id: string }>(
      `insert into public.communities (slug, name, description, kind, email_domain, created_by, meta)
       values ($1, $2, $3, $4, $5, $6, '{"seed": true}') returning id`,
      [c.slug, c.name, c.description, c.kind, c.emailDomain, houseId],
    );
    communityIds.set(c.slug, row.id);
  }
  for (const u of USERS) {
    for (const slug of u.communities) {
      await asUser(byUsername.get(u.username)!, `insert into public.community_members (community_id) values ($1)`, [
        communityIds.get(slug),
      ]);
    }
  }

  // Follows: everyone follows a handful of others.
  for (const follower of userIds) {
    for (const followee of userIds) {
      if (follower !== followee && rand() < 0.3) {
        await asUser(follower, `insert into public.follows (followee_id) values ($1)`, [followee]);
      }
    }
  }

  // Resolved history first, so profiles have records.
  for (const m of RESOLVED_MARKETS) {
    const creator = rand() < 0.6 ? houseId : pick(userIds);
    const id = await insertMarket(m, creator, m.community ? communityIds.get(m.community)! : null, 24);
    await placeBets(id, m.lean, userIds, 0.7);
    await addComments(id, userIds, 1 + Math.floor(rand() * 4));
    await asUser(houseId, `select * from public.resolve_market($1, $2, $3, null)`, [
      id,
      m.outcome,
      `Resolved ${m.outcome.toUpperCase()} per: ${m.details}`,
    ]);
    // Move the timeline into the past so it reads as history.
    await q(
      `update public.markets
          set created_at = now() - make_interval(hours => $2 + 72),
              closes_at = now() - make_interval(hours => $2),
              resolves_by = now() - make_interval(hours => $2) + interval '1 day',
              resolved_at = now() - make_interval(hours => $2) + interval '2 hours'
        where id = $1`,
      [id, m.hours],
    );
    await q(
      `update public.bets
          set created_at = now() - make_interval(hours => $2 + 1 + (random() * 60)::int),
              settled_at = now() - make_interval(hours => $2) + interval '2 hours'
        where market_id = $1`,
      [id, m.hours],
    );
    await q(`update public.market_settlements set settled_at = now() - make_interval(hours => $2) + interval '2 hours' where market_id = $1`, [
      id,
      m.hours,
    ]);
  }

  // Open markets for the feed.
  let openBets = 0;
  for (const m of OPEN_MARKETS) {
    const creator = rand() < 0.5 ? houseId : pick(userIds);
    const id = await insertMarket(m, creator, m.community ? communityIds.get(m.community)! : null, m.hours);
    const bets = await placeBets(id, m.lean, userIds, 0.15 + rand() * 0.5);
    openBets += bets.length;
    // Most bets happened over the last two days; a few are fresh so "bets in the last minute" isn't always 0.
    await q(
      `update public.bets set created_at = now() - make_interval(mins => (random() * 2880)::int)
        where market_id = $1 and random() < 0.85`,
      [id],
    );
    if (rand() < 0.55) await addComments(id, userIds, 1 + Math.floor(rand() * 5));
    for (const liker of userIds) {
      if (rand() < 0.2) await asUser(liker, `insert into public.market_likes (market_id) values ($1)`, [id]);
    }
  }

  const [{ users, markets, bets }] = await q<{ users: number; markets: number; bets: number }>(
    `select (select count(*)::int from public.profiles where meta ->> 'seed' = 'true') as users,
            (select count(*)::int from public.markets where meta ->> 'seed' = 'true') as markets,
            (select count(*)::int from public.bets b join public.markets m on m.id = b.market_id where m.meta ->> 'seed' = 'true') as bets`,
  );
  const broken = await q(
    `select p.id from public.profiles p left join public.ledger l on l.user_id = p.id
      group by p.id having p.balance <> coalesce(sum(l.amount), 0)`,
  );
  if (broken.length) throw new Error(`Ledger invariant broken for ${broken.length} users`);
  console.log(
    `Seeded ${users} users, ${COMMUNITIES.length} communities, ${markets} markets (${OPEN_MARKETS.length} open, ${RESOLVED_MARKETS.length} resolved), ${bets} bets (${openBets} on open markets).`,
  );
}

async function main() {
  const resetOnly = process.argv.includes("--reset");
  await db.connect();
  try {
    await q("begin");
    await wipe();
    if (!resetOnly) await seed();
    await q("commit");
  } catch (err) {
    await q("rollback");
    throw err;
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
