# Decisions

Choices the spec leaves open, and the default picked for each. Newest at the bottom of each section.

## Open questions from the spec (defaults adopted as written)

| Question | Decision |
|---|---|
| Can creators bet on their own markets? | Yes, but then they cannot resolve them. "Hold no bet" means no bet that isn't cancelled. |
| Do skipped markets reappear? | Not for 7 days, then once more. `get_feed` hides a market for 7 days after a skip and never shows it after a second skip. |
| Rake | 5% (`rake_bps` 500). The house take is a coin sink; no house account in the ledger. |
| Virtual liquidity for displayed odds | 50 coins per side. |
| Stake options | 1, 5, 10, 25. |
| Signup / daily bonus | 1,000 / 100 coins. Daily bonus resets at 00:00 UTC. |
| Minimum time between creation and close | 10 minutes. |
| Username rules | 3–20 chars of `a-z`, `0-9`, `_`. |

## Stack and tooling

- **Next.js 16.4 without Cache Components.** The scaffold turned `cacheComponents` on, but every screen reads the Supabase session cookie, so every page is request-time anyway. Turning it off keeps plain dynamic rendering and avoids Suspense-wrapping every session read. Revisit if a public, cacheable page appears (e.g. logged-out market previews).
- **`proxy.ts` (Next 16's renamed middleware)** refreshes the Supabase session cookie on every request and redirects signed-out users to `/login`. Authorization never relies on it; RLS and the SQL functions do.
- **Auth identity on the server uses `supabase.auth.getClaims()`** (verifies the JWT) rather than `getSession()`.
- **Local Supabase runs without Storage, Realtime, Edge Runtime and Analytics** (`supabase/config.toml`). Phase 1 uses none of them; it makes `supabase start` faster. Realtime comes back on in Phase 3.

## Database

- **Enums for closed sets** (role, ledger kind, category, statuses, side) so generated types are unions.
- **Internal helpers live in a `private` schema** that PostgREST doesn't expose. `post_ledger` stays in `public` because the spec names it, but `EXECUTE` is revoked from `anon`/`authenticated`; only other SECURITY DEFINER functions call it.
- **Balance guard trigger.** Any change to `profiles.balance` outside `post_ledger` raises `balance_write_forbidden`, even for service-role or seed code. `post_ledger` sets a transaction-local flag before updating. This makes the `balance = sum(ledger)` invariant structural, not just a convention.
- **Ledger is append-only by grants plus a trigger.** No role gets UPDATE or DELETE grants, and a trigger rejects every UPDATE. Deletes only happen through cascades when a user is deleted (e.g. `seed:reset`).
- **"Closes at least 10 minutes in the future" is a BEFORE INSERT trigger, not a CHECK.** Postgres rechecks CHECK constraints on every UPDATE, so a `now()` check would start failing on later total updates. The trigger only applies to inserts made by signed-in users; the seed (no JWT) can insert historical markets.
- **Market creation uses column-level INSERT grants**: users can only set question, details, category, community, closes_at and resolves_by. Everything else takes its default (`creator_id` defaults to `auth.uid()`).
- **Profile updates use column-level UPDATE grants**: username, display_name, avatar_url, bio, default_stake only.
- **Question must be 8–120 chars, trimmed, ending in `?`.** The spec gave only the max; 8 stops "Win?" spam.
- **Usernames start NULL** and the app sends new users to `/welcome` to pick one. That way the auth trigger never has to invent a name that could collide.
- **`school_domain`** is filled from the sign-up email only when the domain ends in `.edu`.
- **Error codes** are the exception message (`market_closed`, `exposure_cap`, …); the client maps them to toasts in `src/lib/errors.ts`. The human-readable text goes in HINT.
- **Stake checks order:** `stake > max_stake` → `stake_over_max` is checked before the 1/5/10/25 whitelist (`invalid_stake`), so a 50-coin bet reports the more useful error.
- **Pool membership:** a user's later bets on the same market go into the pool they're already in. `member_count` counts distinct users with an active bet in the pool.
- **`bet_count` counts non-cancelled bets.** Cancelling a bet reverses its totals and count.
- **Lock order** is market row → profile rows (sorted by id) in every money function, so concurrent bets and resolutions can't deadlock.
- **Resolving before `closes_at` is allowed** (events sometimes finish early). Resolution stops betting immediately.
- **Refunded pools still get a `market_settlements` row** (`kind = 'refunded'`, house 0, paid_out = total) so every pool's settlement is auditable. `dust` is a generated column: `total − house_take − paid_out`.
- **A winning bet whose floor-payout is 0 gets no ledger row** (the ledger forbids 0-amount rows). Its `payout` is still recorded as 0. This can only happen at stake 1 against a near-empty losing side.
- **`void_market` and `resolve_market` only accept open or closed markets.** Reversing a resolution is the Phase 3 dispute flow (compensating entries), not Phase 1.
- **Who can do what in /admin:** moderators and admins can resolve, void, feature and delete comments. Only admins can ban. Promote a user with `pnpm make-admin <email>`.
- **Comment deletion is a soft delete via `delete_comment()`** (author or moderator) so replies survive. The RLS DELETE policy for own comments still exists as the spec says, but the UI doesn't use it.
- **Rate limits (per user, rolling 60 s):** 40 bets, 6 comments, 3 market creations. Seeding bypasses them with a transaction-local `bav.seeding` flag that API clients can't set.
- **Community joins are open to everyone in Phase 1.** Email-domain auto-join and any domain gating come in Phase 2.
- **`swipe_events` rows are private** (readable only by their owner); clients may only insert `skip` rows. `place_bet` writes the yes/no rows.
- **Undo doesn't bring a card back after a reload.** The yes/no swipe event stays (it's behavioral data), so `get_feed` keeps hiding the market. The feed puts the card back on top of the local stack on Undo.
- **`get_feed` takes an optional `p_exclude uuid[]`** so prefetching can skip cards already in the client's stack. `get_feed(limit)` still works.
- **"68% of this pool says YES" counts distinct bettors**, not coins. It's a statement about people.
- **pg_cron is created inside a guard** (`if pg_cron is available`), so the migrations also apply to plain Postgres in CI. Supabase local and cloud both have it.
