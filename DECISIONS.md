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

## Landing page and the campus map

- **Signed-out `/` is a landing page; signed-in `/` is the feed.** The proxy rewrites `/` to `/landing` for visitors (the URL stays `/`), and sends signed-in users who hit `/landing` or `/login` to the feed. `/login` still exists for deep links (`?next=`).
- **The map is UChicago's campus, not downtown.** Hyde Park from 55th to 60th Street, Ellis Avenue to the Metra tracks, drawn as inline SVG from a grid scene (`src/components/city/scene.tsx`). It's a map a student recognizes, not a survey: blocks are compressed and some buildings are stand-ins.
- **It's generated, not an image, and it's real pixel art.** Every building is a box or gable on a 24×24 isometric grid (`scene.ts`), turned into triangles (`mesh.ts`) and drawn by WebGL with anti-aliasing off into a canvas at 2 screen pixels per art pixel (1 on phones), upscaled with `image-rendering: pixelated` (`renderer.ts`, `city.tsx`). SVG was tried first and abandoned: it always anti-aliases, so it can never look like Midway's pixel art. A Canvas 2D painter's-algorithm fallback exists for browsers without WebGL.
- **Occlusion comes from the depth buffer, not sorting.** Each vertex carries a "nearness" `x + y + z/16` (constant along the view ray), so buildings, trees and vehicles overlap correctly with no painter's algorithm. Details drawn on walls (windows, outlines) get a small nearness bias so they win ties.
- **Gothic means gothic.** Halls get paired lancet windows with pointed tops, stone course lines, buttresses against both visible walls, an arched door, 1-pixel outlines, clay-tile orange roofs with tile rows, dormers and a chimney, and round corner turrets with conical caps; towers get crenellated parapets and corner pinnacles. Only Rockefeller keeps a slate roof.
- **Mostly gothic, by request.** After the aerial photo, the apartment blocks, Eckhardt, Crerar, Keller and one Campus North tower became orange-roofed gothic halls (with made-up names where the real building is modern). The Reg, Mansueto, Booth, Logan, Ratner, Max P and the Law School stay modern because they're how students recognize the place.
- **Bubbles sit in the negative space.** Six slots in the empty corners around the block (three per side); each bubble takes the nearest free slot on its building's side and a dashed leader line runs to a dot on the building. Only perimeter buildings have anchors (Mansueto, the Reg, Max P, Ratner, Bartlett, Robie, Booth, Ida Noyes, the Metra, Logan, B-J, the Law School, Cobb, the Midway, the sky) so lines never cross the quad; study markets ("midterm", "econ", "pset") go to the Reg. On phones there's no margin, so bubbles become a swipeable strip under the map.
- **A hazy downtown on the horizon.** Willis, Hancock, Trump, Aon, Marina City, Crain and company as screen-space silhouettes behind the block, pale by day, dark with lit windows and blinking antenna lights at night, with a sliver of lake at the horizon line. It's a vignette: downtown isn't actually south-west of campus.
- **The final cast (Oct 11, late):** the Reg and Mansueto, Ratner, the quad (Cobb, Hull Court and Botany Pond, Hutch, Reynolds, Mitchell Tower, Classics, Harper and its towers), Saieh, Rockefeller, Robie House, and Booth as just its winter garden: a freestanding glass pavilion whose four spiral columns show through the glass, drawn last so buildings behind it show through too. Max P, Logan, Bartlett, B-J, the Law School, the Oriental Institute, Bond Chapel and the Metra were cut at the owner's request. Ratner is drawn as it is: a glass hall under a roof that sags between three tall masts, with cables fanning to the eaves. The Reg is stepped limestone masses with deep fins, a cornice band, a setback top floor and an entrance plaza.
- **The skyline is a wash.** Downtown is drawn big (Willis 186 units tall) and detailed (tube setbacks, Hancock's X-bracing, Marina City's balconies, Trump's setbacks and spire, Aon's stripes, the Wrigley clock tower, Tribune's crown) but at 26% opacity by day and 42% at night, so it reads as distance, not subject.
- **A static, landing-only copy for GitHub Pages (Oct 18).** The owner wanted a github.io link to share. Pages can't run the app, so a second build produces plain files for the landing page alone. Choices:
  - **One project, two builds.** `PAGES_BUILD=1` switches on `output: "export"` and `pageExtensions: ["static.tsx"]`, so only `layout.static.tsx` and `page.static.tsx` are routes and the proxy, route handlers and Supabase code are never compiled. A separate app was rejected because it would duplicate the map renderer and drift. The normal build ignores the `.static.tsx` files, which a full `pnpm build` confirms.
  - **One page body.** The landing page moved into `landing-view.tsx`; the real page feeds it live data and the sign-in form, the static page feeds it the snapshot. The view must never import Supabase, because `lib/env` throws when the variables are missing.
  - **Frozen sample bets, labeled as such.** There is no cloud database, so `pnpm snapshot` copies the anonymous landing RPC results (no user ids) into `snapshot.json`. Markets with fewer than three bets are left out so no bubble shows 0 coins. Closing times are stored as offsets from the build so the board never reads "closed", "bets in the last minute" is zeroed, and the live stats line is hidden. Copy says "sample bets" and "this page is a preview"; the sign-in section becomes a link to the code.
  - **Deploys push a branch, not a workflow.** `pnpm deploy:pages` force-pushes the build to `gh-pages`. A GitHub Actions workflow would redeploy on every push, but pushing workflow files needs a token scope the saved git credentials may not have, and a branch deploy can be verified immediately. Cost: the owner (or I) must run it after landing changes.
  - **ThemeToggle follows the page.** The static copy can't read the theme cookie on a server, so a small inline script sets the class before paint and the toggle reads the class through `useSyncExternalStore` instead of trusting a prop. The real app behaves as before.
- **The winter garden is four quarters, each dented (Oct 11, latest).** Three roof shapes came and went (nested gables, a W, a zigzag of ridges) before the owner's aerial settled it: a flat steel rim and a cross of ridges at the eave divide the roof into four squares, and each square is an inverted glass pyramid whose low point sits 15 units down over the spiral column in the middle of that quarter. Two facets of each dent catch the sky and two sit in shadow, concentric diamond mullions ring the low point, and steel creases run from it to the four corners. The columns moved to the exact quarter centres; each one's trunk rises to just under its dent and eight ribs run along the underside of the glass to the creases and edge midpoints. Two rendering lessons: the roof is drawn before the walls, because the walls write depth and were clipping the parts of the dents below the wall tops; and the old eave beam was a full box whose top face hid the whole roof, so it is now four thin fascia beams along the edges.
- **The winter garden got the Ida Noyes lot (Oct 11, latest).** The owner wanted the spirals bigger and "how they appear in real life", so Ida Noyes was cut and the pavilion grew to 3.4×3 tiles and 92 units tall. The four columns are now built the way the real ones are: square shafts that rotate a quarter turn as they rise (stacked 2-unit slices with the corner edges drawn as dark helices), bright white with real shadow faces so they read through the glass, and a capital from which four arms flare out to the roof plane. The glass is nearly clear (alpha 0.18–0.22) with sparse mullions; the far walls are drawn first and almost invisible so the box still reads as a volume. `Mesh.prism` took a `phase` argument for the capital.
- **Landmarks only, like Midway's map.** The street-grid survey was replaced by a 22×22 block holding only the buildings a student knows: Mansueto and the Reg in front (Stagg Field and Campus North were cut to make room), Max P, Ratner, the quad (Hull Court and Botany Pond, Hutch, Reynolds and Mitchell Tower, Cobb with its center bay, Classics, Bond Chapel's steeple, Harper and its twin towers), Saieh's tower and cloister, Rockefeller with a transept, rose window and belfry, Bartlett, Robie House, Booth, Ida Noyes, and Logan, B-J and the Law School on the skyline. Tiles are 40 units wide (were 32) so each building gets more pixels. Geography is approximate on purpose.
- **The camera looks from the north-east.** From the south-east (the first cut), Mitchell Tower and the quad's north range hid Mansueto and Campus North. Campus coordinates are flipped (`toScene` in `scene.ts`) before they reach the Mesh, which still thinks the camera is at +x+y; that keeps every "front face" rule (windows, dormers, doors, turrets) correct without rewriting it. Bubble anchors go through the same flip, and anchors whose bubble would hang above the map (now the far Logan corner) are skipped.
- **Ivy and students are geometry too.** Ivy is a few hundred two-tone dots per wall in ragged patches that thin out with height, on the quad's halls, Bartlett and Saieh. Students are three stacked dots (shoes, shirt, head) walking fixed routes along the quad paths, the Midway and the sidewalks, with a slight bob; they rebuild every frame with the vehicles. The WebGL context keeps its drawing buffer so the map can be right-click-saved.
- **One art pixel per CSS pixel** (`scale = 1` in `city.tsx`), the density of Midway's 1× PNG; on a retina screen each art pixel is a crisp 2×2. Two was tried and looked chunky once the gothic detail went in.
- **One palette object per theme** (`palette.ts`); dark mode is watched on `<html class>` and rebuilds the static geometry. At night 70% of windows light up (a stable per-window hash), the rest stay dark.
- **Everything rebuilds from scratch each frame during the 1.5 s grow-in**, then the static geometry is built once and only vehicles, clouds and stars are rebuilt per frame. The loop pauses off-screen and under `prefers-reduced-motion` (one static frame, nothing moves).
- **Bet bubbles are real markets.** `get_landing_markets` (anon-callable, SECURITY DEFINER, no user ids) returns open markets; each landmark has keywords, a market lands on the first landmark its question mentions, unmatched ones fall back by category (sports → Stagg Field, campus → the quad, news → the sky over the Midway, culture → Logan, crypto → Booth), and a greedy pass keeps at most six that don't overlap. Phones show the first four.
- **Bubble letters are Fredoka** (Google Fonts via `next/font`), loaded only on the landing page.
- **Seed questions name campus places** (the Reg, Saieh Hall, Botany Pond, the Pub at Ida Noyes, Stagg, the Midway rink, the 55 bus, Metra) so the day-one map has bubbles.
- **React StrictMode remounts reuse the WebGL context.** `destroy()` frees buffers but never calls `loseContext()`, because a lost context can't be reacquired on the same canvas and the 2D fallback can't attach to a canvas that already has one.
- **Turbopack's Tailwind rule excludes `*.module.css`.** The scaffold ran every stylesheet through `@tailwindcss/turbopack` as plain CSS, which silently dropped CSS-module class exports.
