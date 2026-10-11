# Bet-a-Verse — Build Plan

Source of truth: the build spec (Oct 11, 2026). Choices the spec leaves open are in [DECISIONS.md](DECISIONS.md).

## Phase 1: the loop

### Foundation
- [x] Scaffold Next.js (App Router, TS strict, Tailwind, pnpm), Supabase CLI config, Vitest, Playwright
- [ ] PLAN.md, DECISIONS.md, .env.example, README

### Database (supabase/migrations)
- [x] Schema: profiles, ledger, communities, community_members, markets, pools, bets, market_settlements, comments, market_likes, comment_likes, follows, swipe_events
- [x] Triggers: pool 0 on market insert, like/comment/member counters, balance guard, ledger append-only, comment depth, market insert rules (10-minute close, rate limit)
- [x] Money functions (SECURITY DEFINER, stable error codes): post_ledger, place_bet, cancel_bet, resolve_market, void_market, close_due_markets, claim_daily_bonus
- [x] get_feed(limit, exclude) with ranking score
- [x] Admin helpers: is_admin, is_moderator, set_market_featured, delete_comment, set_user_banned
- [x] Auth trigger: profile + 1,000-coin signup bonus
- [x] RLS + column grants (client never writes balances, bets, totals, status or outcome)
- [x] pg_cron job: close_due_markets every minute
- [x] Generated database types checked in (src/lib/database.types.ts)

### Seed
- [x] `pnpm seed`: 3 communities, 12 fake users, ~60 open markets over 7 days, 15 resolved markets, bets and comments
- [x] `pnpm seed:reset`: voids then deletes everything flagged `meta.seed`
- [x] `pnpm db:reset`: rebuild from migrations and reseed

### App
- [ ] Supabase clients (browser, server, proxy session refresh)
- [ ] /login: magic link + 6-digit code + Google; /welcome username step; signup-bonus toast
- [ ] / Feed: card stack module (gesture physics isolated), stake pill, NO/Skip/YES buttons, keyboard arrows, optimistic bet, reveal, Undo toast (cancel_bet), prefetch at 5 left, empty state, reduced motion, vibration
- [ ] /m/[id]: market detail, split bar, position, bet buttons, like, share, comments with YES/NO badges, outcome banner + result
- [ ] /create: live validation, quick picks, success screen with share link
- [ ] /u/[username]: stats (coins, W–L, win rate, streaks), communities, follows, Picks / Markets tabs
- [ ] /admin: markets table by status, resolve/void with note + proof URL, feature, delete comments, ban
- [ ] PWA manifest + icons, light/dark theme

### Tests
- [x] Vitest unit: settlement math, implied price, estimated payout (worked numbers in test names)
- [x] Vitest DB: every required case from the spec against the real SQL functions
- [ ] Playwright smoke: sign up → username → swipe → bet

### Definition of done
- [ ] New user signs up, gets 1,000 coins
- [ ] Bets on 10 seeded markets in under 60 seconds, balance changes
- [ ] Opens a market and comments
- [ ] Creates a market
- [ ] Admin resolves a market; every payout matches the settlement math
- [ ] Live on a Vercel URL (needs the owner's Vercel + Supabase accounts — see README › Deploy)

## Phase 2: the social layer (not started)
Communities pages + auto-join, follows in reveal, leaderboards, OG share cards + ?ref, notifications, streaks + daily bonus UI.

## Phase 3: pools and hardening (not started)
Pools of 20, dispute window, Realtime, install prompt + web push, ranking refinements, anti-spam.
