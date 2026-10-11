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

## Auth and onboarding

- **Sign-in emails carry a magic link and a 6-digit code.** An installed PWA opens email links in the system browser, so the session would land in the wrong place; the code works everywhere. The template lives in `supabase/templates/magic_link.html` and must be pasted into the cloud dashboard.
- **The signup-bonus toast shows right after the username step** (`/?welcome=1`).
- **Theme is a cookie** (`theme=dark|light`), default light, so the server renders the right theme with no flash. Toggle in the header.
- **Dates render in America/Chicago on the server** (the launch campus) and switch to the viewer's timezone after hydration (`LocalTime`). Vercel's servers run in UTC.

## Feed and cards

- **The stake pill sits inside the card, bottom-left; NO / Skip / YES are a full-width row under the card.** At 375 px there's no room for the pill and three buttons in one row without shrinking tap targets.
- **Changing the stake on the feed also saves it as the profile's `default_stake`**, so the next session starts where you left off.
- **The Undo toast goes to the top of the feed and the reveal is centered on the next card.** At the bottom, the toast would cover the stake pill and buttons for 5 seconds, and that's exactly when the next swipe happens.
- **The Undo toast's lifetime is shortened by the round trip** (5 s − elapsed − 400 ms margin), so a tap on Undo never lands after the server's 5-second window.
- **Estimates when a side is empty.** On a fresh market the card says "Be the first to call it". When only one side has coins, the line for the other side reads "no one on YES yet" (or NO) instead of an estimate. The spec's literal "Be the first to call it" read backwards on the side that already has bets.
- **A committed card flies off on its own layer** and the next card is interactive immediately; `place_bet` starts at commit, not after the animation.
- **Balance is optimistic.** It ticks down at commit; when the RPC returns, the authoritative balance minus stakes still in flight replaces it. A failed bet restores the coins and, for retryable errors (balance, rate limit), puts the card back.
- **Keyboard:** ← NO, → YES, ↑ skip, 1–4 picks the stake.
- **`/c` exists in Phase 1 as a plain browse/join list**, because the empty feed state links to Communities. Community pages, auto-join and leaderboards stay in Phase 2.

## Market detail, profiles, admin

- **"You won 9 coins" is the gross payout**, matching the card's "~9 coins if you're right". Losses show the stake. Refunds say so.
- **A comment's YES/NO badge is the side the author has more coins on** (ties show YES).
- **Eligible users see the resolve panel on the market page**: moderators, and the creator when they hold no non-cancelled bet. It and `/admin` ask for one confirmation, because resolution is final in Phase 1. That doesn't conflict with "no confirm dialogs", which is about betting.
- **`/admin` opens on the resolution queue** (closed markets, oldest resolve-by first). Overdue markets are flagged.
- **Win streaks** are consecutive won bets ordered by settlement time. Refunds and cancels don't break or extend a streak.
- **The daily bonus function ships in Phase 1, but its button doesn't.** Streak and daily-bonus UI is Phase 2.

## Seed

- **Seed users are SQL-inserted `auth.users` rows** at `@seed.betaverse.local`. They can't sign in. A reserved admin account, `@betaverse`, creates the "official" markets and resolves the historical ones.
- **All seed bets, resolutions and voids go through the real functions**, so the ledger invariant holds; the seed fails if it doesn't. Timestamps are backdated afterwards so history reads naturally. Ledger rows keep their real insert time, since the ledger is append-only.

## PWA

- **The service worker only serves an offline page for navigations.** No API or asset caching, so a deploy is never hidden behind a stale cache. Web push comes in Phase 3.
- **Icons are drawn with `next/og` at request time** (`/icons/192`, `/icons/512`, `/icons/maskable`, `icon`, `apple-icon`), so there are no binary assets to keep in sync.
