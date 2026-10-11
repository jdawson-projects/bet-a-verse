-- Feed, profile stats and moderation functions.

-- ---------------------------------------------------------------------------
-- get_feed: open markets the user hasn't acted on, ranked.
--   +3 in one of the user's communities, +4 featured, +2 closes within 24h,
--   +1 per bet in the last 10 minutes (max +5), plus jitter in [0, 1).
-- Skips hide a market for 7 days; after a second skip it never returns.
-- p_exclude lets the client prefetch without getting back cards it already holds.
-- ---------------------------------------------------------------------------
create function public.get_feed(p_limit integer default 10, p_exclude uuid[] default '{}')
returns table (
  id uuid,
  question text,
  details text,
  category public.market_category,
  community_id uuid,
  community_slug text,
  community_name text,
  creator_id uuid,
  creator_username text,
  closes_at timestamptz,
  yes_total integer,
  no_total integer,
  bet_count integer,
  like_count integer,
  comment_count integer,
  bets_last_minute integer,
  rake_bps integer,
  max_stake integer,
  featured boolean,
  liked boolean,
  score double precision
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.fail('not_authenticated', 'Sign in first');
  end if;

  return query
  with candidates as (
    select m.*
    from public.markets m
    join public.profiles creator on creator.id = m.creator_id
    where m.status = 'open'
      and m.closes_at > now()
      and creator.banned_at is null
      and not (m.id = any (coalesce(p_exclude, '{}'::uuid[])))
      and not exists (
        select 1 from public.swipe_events s
        where s.user_id = v_uid and s.market_id = m.id
          and (s.action <> 'skip' or s.created_at > now() - interval '7 days')
      )
      and (
        select count(*) from public.swipe_events s
        where s.user_id = v_uid and s.market_id = m.id and s.action = 'skip'
      ) < 2
  ),
  scored as (
    select
      c.*,
      (
        case when exists (
          select 1 from public.community_members cm
          where cm.user_id = v_uid and cm.community_id = c.community_id
        ) then 3 else 0 end
        + case when c.featured_at is not null then 4 else 0 end
        + case when c.closes_at <= now() + interval '24 hours' then 2 else 0 end
        + least(5, (
            select count(*) from public.bets b
            where b.market_id = c.id and b.status <> 'cancelled'
              and b.created_at > now() - interval '10 minutes'
          ))
      )::double precision + random() as rank_score
    from candidates c
  )
  select
    s.id,
    s.question,
    s.details,
    s.category,
    s.community_id,
    co.slug,
    co.name,
    s.creator_id,
    cr.username,
    s.closes_at,
    s.yes_total,
    s.no_total,
    s.bet_count,
    s.like_count,
    s.comment_count,
    (
      select count(*)::integer from public.bets b
      where b.market_id = s.id and b.status <> 'cancelled'
        and b.created_at > now() - interval '1 minute'
    ),
    s.rake_bps,
    s.max_stake,
    s.featured_at is not null,
    exists (select 1 from public.market_likes ml where ml.market_id = s.id and ml.user_id = v_uid),
    s.rank_score
  from scored s
  join public.profiles cr on cr.id = s.creator_id
  left join public.communities co on co.id = s.community_id
  order by s.rank_score desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
end;
$$;

-- ---------------------------------------------------------------------------
-- get_profile_stats: record, win rate, win streaks, net coins, follow counts.
-- A "win" is a bet with status won; refunds and cancels don't count.
-- ---------------------------------------------------------------------------
create function public.get_profile_stats(p_user_id uuid)
returns table (
  wins integer,
  losses integer,
  win_rate numeric,
  current_streak integer,
  best_streak integer,
  net_won integer,
  active_bets integer,
  followers integer,
  following integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bet record;
  v_wins integer := 0;
  v_losses integer := 0;
  v_run integer := 0;
  v_best integer := 0;
  v_net integer := 0;
begin
  if auth.uid() is null then
    perform private.fail('not_authenticated', 'Sign in first');
  end if;

  for v_bet in
    select b.status, b.stake, coalesce(b.payout, 0) as payout
    from public.bets b
    where b.user_id = p_user_id and b.status in ('won', 'lost')
    order by b.settled_at, b.created_at, b.id
  loop
    v_net := v_net + v_bet.payout - v_bet.stake;
    if v_bet.status = 'won' then
      v_wins := v_wins + 1;
      v_run := v_run + 1;
      v_best := greatest(v_best, v_run);
    else
      v_losses := v_losses + 1;
      v_run := 0;
    end if;
  end loop;

  return query
  select
    v_wins,
    v_losses,
    case when v_wins + v_losses = 0 then null
         else round(v_wins::numeric / (v_wins + v_losses), 4) end,
    v_run,
    v_best,
    v_net,
    (select count(*)::integer from public.bets b where b.user_id = p_user_id and b.status = 'active'),
    (select count(*)::integer from public.follows f where f.followee_id = p_user_id),
    (select count(*)::integer from public.follows f where f.follower_id = p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------
create function public.set_market_featured(p_market_id uuid, p_featured boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_featured_at timestamptz;
begin
  if not public.is_moderator() then
    perform private.fail('not_allowed', 'Moderators only');
  end if;
  update public.markets
     set featured_at = case when p_featured then now() else null end
   where id = p_market_id
  returning featured_at into v_featured_at;
  if not found then
    perform private.fail('market_not_found', 'That market does not exist');
  end if;
  return v_featured_at;
end;
$$;

-- Soft delete, so replies survive. Authors and moderators.
create function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment public.comments%rowtype;
begin
  if auth.uid() is null then
    perform private.fail('not_authenticated', 'Sign in first');
  end if;
  select * into v_comment from public.comments where id = p_comment_id for update;
  if not found then
    perform private.fail('comment_not_found', 'That comment does not exist');
  end if;
  if v_comment.user_id <> auth.uid() and not public.is_moderator() then
    perform private.fail('not_allowed', 'You can only delete your own comments');
  end if;
  if v_comment.deleted_at is null then
    update public.comments set deleted_at = now() where id = p_comment_id;
  end if;
end;
$$;

create function public.set_user_banned(p_user_id uuid, p_banned boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_banned_at timestamptz;
begin
  if not public.is_admin() then
    perform private.fail('not_allowed', 'Admins only');
  end if;
  if p_user_id = auth.uid() then
    perform private.fail('not_allowed', 'You cannot ban yourself');
  end if;
  update public.profiles
     set banned_at = case when p_banned then coalesce(banned_at, now()) else null end
   where id = p_user_id
  returning banned_at into v_banned_at;
  if not found then
    perform private.fail('profile_not_found', 'No such user');
  end if;
  return v_banned_at;
end;
$$;
