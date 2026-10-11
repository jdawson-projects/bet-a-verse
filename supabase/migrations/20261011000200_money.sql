-- Money functions. Each is SECURITY DEFINER, runs in one transaction, checks
-- auth.uid() where a user is acting, and raises a stable error code.
-- Coins move only through post_ledger. Lock order everywhere: market row, then
-- profile rows sorted by id.

-- ---------------------------------------------------------------------------
-- post_ledger: the only way coins move.
-- ---------------------------------------------------------------------------
create function public.post_ledger(
  p_user_id uuid,
  p_amount integer,
  p_kind public.ledger_kind,
  p_ref_type text default null,
  p_ref_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
begin
  if p_amount is null or p_amount = 0 then
    perform private.fail('invalid_amount', 'Ledger amounts must be non-zero');
  end if;

  select balance into v_balance from public.profiles where id = p_user_id for update;
  if not found then
    perform private.fail('profile_not_found', 'No profile for that user');
  end if;
  if v_balance + p_amount < 0 then
    perform private.fail('insufficient_balance', 'Not enough coins');
  end if;

  insert into public.ledger (user_id, amount, kind, ref_type, ref_id)
  values (p_user_id, p_amount, p_kind, p_ref_type, p_ref_id);

  perform set_config('bav.ledger_write', 'on', true);
  update public.profiles
     set balance = balance + p_amount
   where id = p_user_id
  returning balance into v_balance;
  perform set_config('bav.ledger_write', 'off', true);

  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_bet
-- ---------------------------------------------------------------------------
create function public.place_bet(
  p_market_id uuid,
  p_side public.bet_side,
  p_stake integer,
  p_dwell_ms integer default null
)
returns table (
  bet_id uuid,
  market_id uuid,
  pool_id uuid,
  side public.bet_side,
  stake integer,
  price_at_bet numeric,
  created_at timestamptz,
  balance integer,
  yes_total integer,
  no_total integer,
  implied_yes numeric,
  pool_yes_total integer,
  pool_no_total integer,
  pool_yes_bettors integer,
  pool_no_bettors integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_market public.markets%rowtype;
  v_profile public.profiles%rowtype;
  v_pool public.pools%rowtype;
  v_exposure integer;
  v_new_member boolean;
  v_bet public.bets%rowtype;
  v_balance integer;
begin
  if v_uid is null then
    perform private.fail('not_authenticated', 'Sign in to bet');
  end if;
  if p_side is null then
    perform private.fail('invalid_side', 'Pick YES or NO');
  end if;

  select * into v_market from public.markets m where m.id = p_market_id for update;
  if not found then
    perform private.fail('market_not_found', 'That market does not exist');
  end if;

  select * into v_profile from public.profiles pr where pr.id = v_uid for update;
  if not found then
    perform private.fail('profile_not_found', 'Finish signing up first');
  end if;
  if v_profile.banned_at is not null then
    perform private.fail('banned', 'Your account is suspended');
  end if;

  if v_market.status <> 'open' or v_market.closes_at <= now() then
    perform private.fail('market_closed', 'Betting has closed on this market');
  end if;
  if p_stake is null or p_stake > v_market.max_stake then
    perform private.fail('stake_over_max', format('Max stake on this market is %s coins', v_market.max_stake));
  end if;
  if p_stake not in (1, 5, 10, 25) then
    perform private.fail('invalid_stake', 'Stake must be 1, 5, 10 or 25 coins');
  end if;

  if not private.is_seeding() and (
    select count(*) from public.bets b
    where b.user_id = v_uid and b.created_at > now() - interval '1 minute'
  ) >= 40 then
    perform private.fail('rate_limited', 'Easy there. Try again in a few seconds');
  end if;

  select coalesce(sum(b.stake), 0) into v_exposure
  from public.bets b
  where b.market_id = p_market_id and b.user_id = v_uid and b.status = 'active';
  if v_exposure + p_stake > 100 then
    perform private.fail('exposure_cap', 'You can stake at most 100 coins on one market');
  end if;

  if v_profile.balance < p_stake then
    perform private.fail('insufficient_balance', 'Not enough coins');
  end if;

  -- Pool: the one the user is already in, else the first with room, else a new one.
  select p.* into v_pool
  from public.pools p
  join public.bets b on b.pool_id = p.id
  where p.market_id = p_market_id and b.user_id = v_uid and b.status = 'active'
  limit 1;
  v_new_member := not found;

  if v_new_member then
    select p.* into v_pool
    from public.pools p
    where p.market_id = p_market_id
      and p.status = 'open'
      and (p.capacity is null or p.member_count < p.capacity)
    order by p.index
    limit 1;
    if not found then
      insert into public.pools (market_id, index, capacity)
      select p_market_id, coalesce(max(p.index), -1) + 1, v_market.pool_capacity
      from public.pools p where p.market_id = p_market_id
      returning * into v_pool;
    end if;
  end if;

  insert into public.bets (market_id, pool_id, user_id, side, stake, price_at_bet)
  values (
    p_market_id, v_pool.id, v_uid, p_side, p_stake,
    public.implied_yes(v_market.yes_total, v_market.no_total)
  )
  returning * into v_bet;

  v_balance := public.post_ledger(v_uid, -p_stake, 'bet', 'bet', v_bet.id);

  insert into public.swipe_events (user_id, market_id, action, dwell_ms)
  values (v_uid, p_market_id, p_side::text::public.swipe_action, p_dwell_ms);

  update public.pools p
     set yes_total = p.yes_total + case when p_side = 'yes' then p_stake else 0 end,
         no_total = p.no_total + case when p_side = 'no' then p_stake else 0 end,
         member_count = p.member_count + case when v_new_member then 1 else 0 end
   where p.id = v_pool.id
  returning * into v_pool;

  update public.markets m
     set yes_total = m.yes_total + case when p_side = 'yes' then p_stake else 0 end,
         no_total = m.no_total + case when p_side = 'no' then p_stake else 0 end,
         bet_count = m.bet_count + 1
   where m.id = p_market_id
  returning * into v_market;

  return query
  select
    v_bet.id, v_bet.market_id, v_bet.pool_id, v_bet.side, v_bet.stake, v_bet.price_at_bet, v_bet.created_at,
    v_balance, v_market.yes_total, v_market.no_total,
    public.implied_yes(v_market.yes_total, v_market.no_total),
    v_pool.yes_total, v_pool.no_total,
    (select count(distinct b.user_id)::integer from public.bets b
      where b.pool_id = v_pool.id and b.status = 'active' and b.side = 'yes'),
    (select count(distinct b.user_id)::integer from public.bets b
      where b.pool_id = v_pool.id and b.status = 'active' and b.side = 'no');
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_bet: own bet, within 5 seconds, market still open.
-- ---------------------------------------------------------------------------
create function public.cancel_bet(p_bet_id uuid)
returns table (
  bet_id uuid,
  market_id uuid,
  balance integer,
  yes_total integer,
  no_total integer,
  implied_yes numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_bet public.bets%rowtype;
  v_market public.markets%rowtype;
  v_balance integer;
begin
  if v_uid is null then
    perform private.fail('not_authenticated', 'Sign in first');
  end if;

  select * into v_bet from public.bets b where b.id = p_bet_id;
  if not found then
    perform private.fail('bet_not_found', 'That bet does not exist');
  end if;
  if v_bet.user_id <> v_uid then
    perform private.fail('not_your_bet', 'You can only undo your own bets');
  end if;

  select * into v_market from public.markets m where m.id = v_bet.market_id for update;
  perform 1 from public.profiles pr where pr.id = v_uid for update;
  select * into v_bet from public.bets b where b.id = p_bet_id for update;

  if v_bet.status <> 'active' then
    perform private.fail('bet_not_active', 'That bet can no longer be undone');
  end if;
  if now() - v_bet.created_at > interval '5 seconds' then
    perform private.fail('undo_window_expired', 'Too late to undo. Bets lock after 5 seconds');
  end if;
  if v_market.status <> 'open' or v_market.closes_at <= now() then
    perform private.fail('market_closed', 'Betting has closed on this market');
  end if;

  update public.bets b set status = 'cancelled', settled_at = now() where b.id = v_bet.id;
  v_balance := public.post_ledger(v_uid, v_bet.stake, 'bet_cancel', 'bet', v_bet.id);

  update public.pools p
     set yes_total = p.yes_total - case when v_bet.side = 'yes' then v_bet.stake else 0 end,
         no_total = p.no_total - case when v_bet.side = 'no' then v_bet.stake else 0 end,
         member_count = p.member_count - case when exists (
           select 1 from public.bets b
           where b.pool_id = v_bet.pool_id and b.user_id = v_uid and b.status = 'active'
         ) then 0 else 1 end
   where p.id = v_bet.pool_id;

  update public.markets m
     set yes_total = m.yes_total - case when v_bet.side = 'yes' then v_bet.stake else 0 end,
         no_total = m.no_total - case when v_bet.side = 'no' then v_bet.stake else 0 end,
         bet_count = m.bet_count - 1
   where m.id = v_bet.market_id
  returning * into v_market;

  return query
  select v_bet.id, v_bet.market_id, v_balance, v_market.yes_total, v_market.no_total,
         public.implied_yes(v_market.yes_total, v_market.no_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- Settlement helpers (private; the market row must already be locked).
-- ---------------------------------------------------------------------------

-- Refund every active bet in a pool in full, no rake.
create function private.refund_pool(p_pool_id uuid, p_outcome public.bet_side)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pool public.pools%rowtype;
  v_bet record;
  v_total integer := 0;
begin
  select * into v_pool from public.pools where id = p_pool_id for update;

  for v_bet in
    select b.id, b.user_id, b.stake from public.bets b
    where b.pool_id = p_pool_id and b.status = 'active'
    order by b.user_id, b.created_at
  loop
    update public.bets set status = 'refunded', payout = v_bet.stake, settled_at = now() where id = v_bet.id;
    perform public.post_ledger(v_bet.user_id, v_bet.stake, 'refund', 'bet', v_bet.id);
    v_total := v_total + v_bet.stake;
  end loop;

  update public.pools set status = 'refunded' where id = p_pool_id;
  insert into public.market_settlements (market_id, pool_id, kind, outcome, total, house_take, distributable, paid_out)
  values (v_pool.market_id, p_pool_id, 'refunded', p_outcome, v_total, 0, v_total, v_total);
  return v_total;
end;
$$;

-- Parimutuel settlement of one pool:
--   total = yes + no; house = floor(total * rake_bps / 10000); distributable = total - house
--   winner payout = floor(stake * distributable / winning_total); loser payout = 0
-- A pool with an empty side is refunded instead.
create function private.settle_pool(p_pool_id uuid, p_outcome public.bet_side, p_rake_bps integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pool public.pools%rowtype;
  v_yes integer;
  v_no integer;
  v_total integer;
  v_house integer;
  v_distributable integer;
  v_winning_total integer;
  v_paid integer := 0;
  v_payout integer;
  v_bet record;
begin
  select * into v_pool from public.pools where id = p_pool_id for update;

  -- Totals come from the bets themselves, not the denormalized columns.
  select coalesce(sum(stake) filter (where side = 'yes'), 0),
         coalesce(sum(stake) filter (where side = 'no'), 0)
    into v_yes, v_no
  from public.bets
  where pool_id = p_pool_id and status = 'active';

  if v_yes = 0 or v_no = 0 then
    perform private.refund_pool(p_pool_id, p_outcome);
    return 0;
  end if;

  v_total := v_yes + v_no;
  -- Integer division of non-negative values is floor().
  v_house := (v_total::bigint * p_rake_bps / 10000)::integer;
  v_distributable := v_total - v_house;
  v_winning_total := case when p_outcome = 'yes' then v_yes else v_no end;

  for v_bet in
    select b.id, b.user_id, b.stake, b.side from public.bets b
    where b.pool_id = p_pool_id and b.status = 'active'
    order by b.user_id, b.created_at
  loop
    if v_bet.side = p_outcome then
      v_payout := (v_bet.stake::bigint * v_distributable / v_winning_total)::integer;
      update public.bets set status = 'won', payout = v_payout, settled_at = now() where id = v_bet.id;
      if v_payout > 0 then
        perform public.post_ledger(v_bet.user_id, v_payout, 'payout', 'bet', v_bet.id);
      end if;
      v_paid := v_paid + v_payout;
    else
      update public.bets set status = 'lost', payout = 0, settled_at = now() where id = v_bet.id;
    end if;
  end loop;

  update public.pools set status = 'settled' where id = p_pool_id;
  insert into public.market_settlements (market_id, pool_id, kind, outcome, total, house_take, distributable, paid_out)
  values (v_pool.market_id, p_pool_id, 'settled', p_outcome, v_total, v_house, v_distributable, v_paid);
  return v_paid;
end;
$$;

-- Lock the profiles of everyone holding an active bet on a market, in id order.
create function private.lock_bettor_profiles(p_market_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles pr
  where pr.id in (select b.user_id from public.bets b where b.market_id = p_market_id and b.status = 'active')
  order by pr.id
  for update;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_market
-- ---------------------------------------------------------------------------
create function public.resolve_market(
  p_market_id uuid,
  p_outcome public.bet_side,
  p_note text default null,
  p_proof_url text default null
)
returns table (
  market_id uuid,
  outcome public.bet_side,
  pools_settled integer,
  pools_refunded integer,
  total integer,
  house_take integer,
  paid_out integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_market public.markets%rowtype;
  v_pool record;
begin
  if v_uid is null then
    perform private.fail('not_authenticated', 'Sign in first');
  end if;
  if p_outcome is null then
    perform private.fail('invalid_outcome', 'Pick YES or NO');
  end if;

  select * into v_market from public.markets m where m.id = p_market_id for update;
  if not found then
    perform private.fail('market_not_found', 'That market does not exist');
  end if;
  if v_market.status in ('resolved', 'voided') then
    perform private.fail('already_settled', 'This market is already settled');
  end if;
  if not public.is_moderator() and not (
    v_market.creator_id = v_uid
    and not public.is_banned()
    and not exists (
      select 1 from public.bets b
      where b.market_id = p_market_id and b.user_id = v_uid and b.status <> 'cancelled'
    )
  ) then
    perform private.fail('not_allowed', 'Only moderators, or a creator with no bet on it, can resolve this market');
  end if;

  perform private.lock_bettor_profiles(p_market_id);

  for v_pool in
    select p.id from public.pools p where p.market_id = p_market_id and p.status = 'open' order by p.index
  loop
    perform private.settle_pool(v_pool.id, p_outcome, v_market.rake_bps);
  end loop;

  update public.markets m
     set status = 'resolved',
         outcome = p_outcome,
         resolution_note = nullif(btrim(p_note), ''),
         resolution_proof_url = nullif(btrim(p_proof_url), ''),
         resolved_by = v_uid,
         resolved_at = now()
   where m.id = p_market_id;

  return query
  select p_market_id, p_outcome,
         count(*) filter (where s.kind = 'settled')::integer,
         count(*) filter (where s.kind = 'refunded')::integer,
         coalesce(sum(s.total), 0)::integer,
         coalesce(sum(s.house_take), 0)::integer,
         coalesce(sum(s.paid_out), 0)::integer
  from public.market_settlements s
  where s.market_id = p_market_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- void_market: refund everything, mark voided. Moderators only.
-- ---------------------------------------------------------------------------
create function public.void_market(p_market_id uuid, p_note text default null)
returns table (market_id uuid, refunded integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_market public.markets%rowtype;
  v_pool record;
  v_refunded integer := 0;
begin
  if v_uid is null and not private.is_seeding() then
    perform private.fail('not_authenticated', 'Sign in first');
  end if;

  select * into v_market from public.markets m where m.id = p_market_id for update;
  if not found then
    perform private.fail('market_not_found', 'That market does not exist');
  end if;
  if v_market.status in ('resolved', 'voided') then
    perform private.fail('already_settled', 'This market is already settled');
  end if;
  if not public.is_moderator() and not private.is_seeding() then
    perform private.fail('not_allowed', 'Only moderators can void markets');
  end if;

  perform private.lock_bettor_profiles(p_market_id);

  for v_pool in
    select p.id from public.pools p where p.market_id = p_market_id and p.status = 'open' order by p.index
  loop
    v_refunded := v_refunded + private.refund_pool(v_pool.id, null);
  end loop;

  update public.markets m
     set status = 'voided',
         resolution_note = nullif(btrim(p_note), ''),
         resolved_by = v_uid,
         resolved_at = now()
   where m.id = p_market_id;

  return query select p_market_id, v_refunded;
end;
$$;

-- ---------------------------------------------------------------------------
-- close_due_markets: open -> closed once closes_at passes. Idempotent; pg_cron.
-- ---------------------------------------------------------------------------
create function public.close_due_markets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.markets
     set status = 'closed'
   where status = 'open' and closes_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_daily_bonus: 100 coins once per UTC day.
-- ---------------------------------------------------------------------------
create function public.claim_daily_bonus()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_banned timestamptz;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  if v_uid is null then
    perform private.fail('not_authenticated', 'Sign in first');
  end if;
  select banned_at into v_banned from public.profiles where id = v_uid for update;
  if not found then
    perform private.fail('profile_not_found', 'Finish signing up first');
  end if;
  if v_banned is not null then
    perform private.fail('banned', 'Your account is suspended');
  end if;
  if exists (
    select 1 from public.ledger
    where user_id = v_uid and kind = 'daily_bonus' and created_at >= v_day_start
  ) then
    perform private.fail('bonus_already_claimed', 'Daily bonus already claimed. Come back tomorrow');
  end if;
  return public.post_ledger(v_uid, 100, 'daily_bonus', 'daily', null);
end;
$$;
