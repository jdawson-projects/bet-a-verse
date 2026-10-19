# Bet-a-Verse

A mobile-first social prediction market. Swipe right for YES, left for NO, a few play coins per swipe. Every market has a comment thread, every bet is public, and resolved markets pay out by parimutuel math.

Play money only: coins can't be bought, deposited or withdrawn. Every coin movement goes through an append-only ledger.

- **Stack:** Next.js 16 (App Router, TypeScript strict, Tailwind 4), Supabase (Postgres, Auth, RLS, pg_cron), motion for the card stack, Vitest + Playwright.
- **Status:** Phase 1 (the loop) is built. See [PLAN.md](PLAN.md). Choices the spec left open are in [DECISIONS.md](DECISIONS.md).

## Run it locally (about 10 minutes)

You need **Node 20+** (22 recommended, see `.nvmrc`), **pnpm** (`corepack enable`), and a **Docker runtime** (Docker Desktop, OrbStack, or `brew install colima docker && colima start`).

```bash
git clone <this repo> bet-a-verse && cd bet-a-verse
corepack enable
pnpm install
pnpm db:start      # local Supabase in Docker; the first run pulls ~3 GB of images
pnpm env:local     # writes .env.local from `supabase status`
pnpm db:reset      # applies supabase/migrations, then seeds day-one content
pnpm dev           # http://localhost:3000
```

**Sign in:** enter any email on `/login`. Local Supabase doesn't send real email; open **Mailpit at http://127.0.0.1:54324**, then click the link or type the 6-digit code into the app. New accounts get 1,000 coins.

**Become an admin** (to resolve markets at `/admin`): sign in once, then

```bash
pnpm make-admin you@example.com            # or: pnpm make-admin you@example.com moderator
```

Supabase Studio (browse tables, run SQL) is at http://127.0.0.1:54323.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm db:start` / `pnpm db:stop` | Start / stop local Supabase |
| `pnpm db:reset` | Rebuild the database from migrations and reseed |
| `pnpm db:types` | Regenerate `src/lib/database.types.ts` from the local schema (commit the result) |
| `pnpm seed` | Wipe seeded rows, then insert fresh day-one content (idempotent) |
| `pnpm seed:reset` | Only wipe seeded rows (live seeded markets are voided first, so real bettors get refunds) |
| `pnpm make-admin <email> [role]` | Set a user's role |
| `pnpm snapshot` | Freeze the landing page's bets from the seeded local database into `src/components/landing/snapshot.json` |
| `pnpm build:pages` | Build the static landing-page-only copy into `out/` (no database, no sign-in) |
| `pnpm deploy:pages` | Build that copy and publish it to the `gh-pages` branch for GitHub Pages |
| `pnpm env:local` | Write `.env.local` from the running local stack |
| `pnpm test` | Vitest: unit tests plus database tests against local Supabase |
| `pnpm test:unit` | Vitest unit tests only (no database needed) |
| `pnpm test:e2e` | Playwright smoke test (sign up → onboard → 10 bets). Needs a seeded local stack |
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` / ESLint |

First Playwright run: `pnpm exec playwright install chromium`.

## How it's put together

```
supabase/
  migrations/          schema, money functions, feed + moderation, RLS, auth trigger + cron
  templates/           sign-in email (magic link + 6-digit code)
  config.toml          local stack config
scripts/               seed, seed reset, make-admin, env-local
src/
  proxy.ts             session refresh + signed-out redirect (Next 16's middleware)
  app/landing/         public landing page (served at "/" when signed out): the campus map, live markets
  app/(app)/           signed-in screens: feed, /m/[id], /create, /u/[username], /admin, /c
  app/login, welcome   sign-in and username onboarding
  components/city/     the isometric UChicago map: projection + depth sort, the scene, the animation loop
  components/landing/  bet bubbles pinned to landmarks, the word cycler
  components/card-stack/  swipe physics only (no data); the feed composes it
  components/feed/     feed data layer: optimistic bets, reveal, undo, prefetch
  lib/money.ts         pricing and settlement math (mirrors SQL; used for estimates and tests)
  lib/database.types.ts  generated, checked in
tests/unit/            pure math tests
tests/db/              SQL function tests, each in a rolled-back transaction
e2e/                   Playwright smoke test
```

### Money rules (enforced in Postgres)

- Clients never write balances, bets, pool totals, market status or outcomes. They call SECURITY DEFINER functions over RPC: `place_bet`, `cancel_bet`, `resolve_market`, `void_market`, `claim_daily_bonus`, `get_feed`. Each checks `auth.uid()` and raises a stable error code (`market_closed`, `exposure_cap`, …) that `src/lib/errors.ts` maps to a toast.
- `post_ledger` is the only code that changes `profiles.balance`; a trigger rejects any other balance write, even from the database owner. `profiles.balance = sum(ledger.amount)` is tested after random operation sequences.
- Stakes are 1, 5, 10 or 25 coins, at most 100 coins per user per market. Undo works within 5 seconds.
- Settlement per pool: `house = floor(total × rake_bps / 10000)`, each winner gets `floor(stake × distributable / winning_total)`, and rounding dust stays with the house. A pool with an empty side, or a voided market, refunds everything.
- `close_due_markets()` runs every minute via pg_cron.

## Landing preview on GitHub Pages

GitHub Pages only serves static files, so it can't run the real app (sessions, the proxy and the database all need a server). It can serve a **landing-page-only copy**: the same page and pixel map, with a frozen board of sample bets and links to this repo instead of sign-in.

- Live at `https://<user>.github.io/bet-a-verse/` once Pages is switched on.
- To refresh the sample bets: `pnpm db:reset` (or `pnpm seed`), then `pnpm snapshot`, and commit `snapshot.json`.
- To publish: `pnpm deploy:pages`. It builds with `PAGES_BUILD=1` and force-pushes `out/` to the `gh-pages` branch, which only ever holds build output.
- One-time setup: repo **Settings → Pages → Build and deployment → Deploy from a branch → `gh-pages` / `/ (root)`**.
- Serving it from a different path (a custom domain at the root, say) means building with `PAGES_BASE_PATH=` set to that path, or empty.

How it works: with `PAGES_BUILD=1`, `next.config.ts` turns on `output: "export"` and sets `pageExtensions: ["static.tsx"]`, so only `layout.static.tsx` and `page.static.tsx` count as routes. The rest of the app, including the proxy, is not compiled. Both landing pages render the shared `landing-view.tsx`.

## Deploy (Vercel + Supabase cloud)

### 1. Supabase project

1. Create a project at supabase.com. Note the project ref, URL, publishable key and database password.
2. Push the schema:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
   The migrations enable `pg_cron` and schedule the close job. Check **Database → Cron** afterwards.
3. **Auth → URL configuration:** set Site URL to your Vercel URL, and add `https://<your-app>.vercel.app/**` (plus preview domains if you use them) to Redirect URLs.
4. **Auth → Email templates → Magic link** and **Confirm signup:** paste `supabase/templates/magic_link.html`. It includes the 6-digit code, which installed-PWA users need.
5. **Auth → SMTP:** configure a real SMTP provider. The built-in sender is heavily rate-limited and only meant for testing.
6. **Google sign-in (optional):** create an OAuth client in Google Cloud with the redirect URI `https://<ref>.supabase.co/auth/v1/callback`, then enable Google under **Auth → Providers**. Locally, set `enabled = true` under `[auth.external.google]` in `supabase/config.toml` and export `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` before `pnpm db:start`.
7. Seed (optional, for a beta): `DATABASE_URL='<session pooler connection string>' pnpm seed`.

### 2. Vercel

1. Import the repo. Framework: Next.js. Node 22.
2. Environment variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://<ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key
   - `NEXT_PUBLIC_SITE_URL`: `https://<your-app>.vercel.app`
3. Deploy, sign in once, then make yourself admin: `DATABASE_URL='<connection string>' pnpm make-admin you@example.com`.

Never commit `.env.local` or any service-role or secret key. The app itself only needs the publishable key; the seed and admin scripts use `DATABASE_URL`.
