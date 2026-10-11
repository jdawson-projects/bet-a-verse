-- Row Level Security and grants.
-- Signed-in users read everything social; they write only their own social rows
-- and the non-money columns of their own profile. Bets, ledger rows, pool totals
-- and market status/outcome change only through the SECURITY DEFINER functions.

-- The guard triggers run as the calling role; let them reach private.fail.
alter function private.guard_profile_balance() security definer;
alter function private.ledger_append_only() security definer;

alter table public.profiles enable row level security;
alter table public.ledger enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.markets enable row level security;
alter table public.pools enable row level security;
alter table public.bets enable row level security;
alter table public.market_settlements enable row level security;
alter table public.comments enable row level security;
alter table public.market_likes enable row level security;
alter table public.comment_likes enable row level security;
alter table public.follows enable row level security;
alter table public.swipe_events enable row level security;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing for API roles, then add exactly what's needed.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select on
  public.profiles, public.ledger, public.communities, public.community_members,
  public.markets, public.pools, public.bets, public.market_settlements,
  public.comments, public.market_likes, public.comment_likes, public.follows,
  public.swipe_events
to authenticated;

grant update (username, display_name, avatar_url, bio, default_stake) on public.profiles to authenticated;
grant insert (question, details, category, community_id, closes_at, resolves_by) on public.markets to authenticated;
grant insert (market_id, parent_id, body), delete on public.comments to authenticated;
grant insert (market_id), delete on public.market_likes to authenticated;
grant insert (comment_id), delete on public.comment_likes to authenticated;
grant insert (followee_id), delete on public.follows to authenticated;
grant insert (community_id), delete on public.community_members to authenticated;
grant insert (market_id, action, dwell_ms) on public.swipe_events to authenticated;

grant execute on function
  public.is_admin(),
  public.is_moderator(),
  public.is_banned(),
  public.implied_yes(integer, integer),
  public.place_bet(uuid, public.bet_side, integer, integer),
  public.cancel_bet(uuid),
  public.resolve_market(uuid, public.bet_side, text, text),
  public.void_market(uuid, text),
  public.claim_daily_bonus(),
  public.get_feed(integer, uuid[]),
  public.get_profile_stats(uuid),
  public.set_market_featured(uuid, boolean),
  public.delete_comment(uuid),
  public.set_user_banned(uuid, boolean)
to authenticated;
-- post_ledger and close_due_markets have no API access at all.

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "users read their own ledger" on public.ledger
  for select to authenticated using (user_id = (select auth.uid()));

create policy "communities readable" on public.communities
  for select to authenticated using (true);

create policy "memberships readable" on public.community_members
  for select to authenticated using (true);
create policy "users join communities" on public.community_members
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users leave communities" on public.community_members
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "markets readable" on public.markets
  for select to authenticated using (true);
create policy "users create markets" on public.markets
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and not (select public.is_banned())
    and (
      community_id is null
      or exists (
        select 1 from public.community_members cm
        where cm.community_id = markets.community_id and cm.user_id = (select auth.uid())
      )
    )
  );

create policy "pools readable" on public.pools
  for select to authenticated using (true);
create policy "bets readable" on public.bets
  for select to authenticated using (true);
create policy "settlements readable" on public.market_settlements
  for select to authenticated using (true);

create policy "comments readable" on public.comments
  for select to authenticated using (true);
create policy "users write comments" on public.comments
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_banned()));
create policy "users delete their own comments" on public.comments
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "market likes readable" on public.market_likes
  for select to authenticated using (true);
create policy "users like markets" on public.market_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users unlike markets" on public.market_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "comment likes readable" on public.comment_likes
  for select to authenticated using (true);
create policy "users like comments" on public.comment_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users unlike comments" on public.comment_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "follows readable" on public.follows
  for select to authenticated using (true);
create policy "users follow" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()) and not (select public.is_banned()));
create policy "users unfollow" on public.follows
  for delete to authenticated using (follower_id = (select auth.uid()));

create policy "users read their own swipes" on public.swipe_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users record skips" on public.swipe_events
  for insert to authenticated
  with check (user_id = (select auth.uid()) and action = 'skip');
