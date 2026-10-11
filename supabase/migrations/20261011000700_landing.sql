-- Public (signed-out) reads for the landing page. Both are SECURITY DEFINER and
-- expose only what a market card shows: no user ids, no ledger, no balances.

create function public.get_landing_markets(p_limit integer default 6)
returns table (
  id uuid,
  question text,
  category public.market_category,
  community_slug text,
  closes_at timestamptz,
  yes_total integer,
  no_total integer,
  bet_count integer,
  bets_last_minute integer,
  featured boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.question,
    m.category,
    c.slug,
    m.closes_at,
    m.yes_total,
    m.no_total,
    m.bet_count,
    (
      select count(*)::integer from public.bets b
      where b.market_id = m.id and b.status <> 'cancelled'
        and b.created_at > now() - interval '1 minute'
    ),
    m.featured_at is not null
  from public.markets m
  join public.profiles p on p.id = m.creator_id
  left join public.communities c on c.id = m.community_id
  where m.status = 'open' and m.closes_at > now() and p.banned_at is null
  order by (m.featured_at is not null) desc, m.bet_count desc, m.closes_at asc
  limit greatest(1, least(coalesce(p_limit, 6), 40));
$$;

create function public.get_landing_stats()
returns table (open_markets integer, bets_today integer, players integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.markets where status = 'open' and closes_at > now()),
    (select count(*)::integer from public.bets where status <> 'cancelled' and created_at > now() - interval '24 hours'),
    (select count(*)::integer from public.profiles where username is not null and banned_at is null);
$$;

revoke all on function public.get_landing_markets(integer) from public;
revoke all on function public.get_landing_stats() from public;
grant execute on function public.get_landing_markets(integer), public.get_landing_stats() to anon, authenticated;
