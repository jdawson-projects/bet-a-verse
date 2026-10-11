-- Bet-a-Verse core schema.
-- Every coin amount is an integer. Money columns (balances, bets, pool and market
-- totals, outcomes) are written only by the SECURITY DEFINER functions in the
-- next migration; RLS and grants in a later migration enforce that.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.ledger_kind as enum (
  'signup_bonus', 'daily_bonus', 'bet', 'bet_cancel', 'payout', 'refund', 'adjustment'
);
create type public.community_kind as enum ('school', 'topic');
create type public.market_category as enum ('sports', 'campus', 'culture', 'crypto', 'news', 'other');
create type public.market_status as enum ('open', 'closed', 'resolved', 'voided');
create type public.bet_side as enum ('yes', 'no');
create type public.pool_status as enum ('open', 'settled', 'refunded');
create type public.bet_status as enum ('active', 'cancelled', 'won', 'lost', 'refunded');
create type public.swipe_action as enum ('yes', 'no', 'skip');
create type public.settlement_kind as enum ('settled', 'refunded');

-- ---------------------------------------------------------------------------
-- Profiles and the ledger
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  avatar_url text check (char_length(avatar_url) <= 500),
  bio text check (char_length(bio) <= 160),
  default_stake integer not null default 5 check (default_stake in (1, 5, 10, 25)),
  balance integer not null default 0 check (balance >= 0),
  role public.user_role not null default 'user',
  school_domain text,
  banned_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount <> 0),
  kind public.ledger_kind not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index ledger_user_created_idx on public.ledger (user_id, created_at desc);
create index ledger_ref_idx on public.ledger (ref_type, ref_id);
create index ledger_daily_bonus_idx on public.ledger (user_id, created_at) where kind = 'daily_bonus';

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 500),
  kind public.community_kind not null,
  email_domain text unique,
  created_by uuid references public.profiles (id) on delete set null,
  member_count integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user_idx on public.community_members (user_id);

-- ---------------------------------------------------------------------------
-- Markets, pools, bets, settlements
-- ---------------------------------------------------------------------------
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  question text not null check (
    char_length(question) between 8 and 120
    and question = btrim(question)
    and right(question, 1) = '?'
  ),
  details text not null default '' check (char_length(details) <= 1000),
  category public.market_category not null default 'other',
  community_id uuid references public.communities (id) on delete set null,
  creator_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  closes_at timestamptz not null,
  resolves_by timestamptz not null,
  status public.market_status not null default 'open',
  outcome public.bet_side,
  resolution_note text check (char_length(resolution_note) <= 1000),
  resolution_proof_url text check (char_length(resolution_proof_url) <= 500),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  rake_bps integer not null default 500 check (rake_bps between 0 and 2000),
  max_stake integer not null default 25 check (max_stake between 1 and 25),
  pool_capacity integer check (pool_capacity is null or pool_capacity >= 2),
  yes_total integer not null default 0 check (yes_total >= 0),
  no_total integer not null default 0 check (no_total >= 0),
  bet_count integer not null default 0 check (bet_count >= 0),
  like_count integer not null default 0,
  comment_count integer not null default 0,
  featured_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint markets_resolves_after_close check (resolves_by >= closes_at),
  constraint markets_outcome_matches_status check ((status = 'resolved') = (outcome is not null))
);
create index markets_status_closes_idx on public.markets (status, closes_at);
create index markets_creator_idx on public.markets (creator_id, created_at desc);
create index markets_community_idx on public.markets (community_id) where community_id is not null;
create index markets_featured_idx on public.markets (featured_at) where featured_at is not null;

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  index integer not null check (index >= 0),
  capacity integer check (capacity is null or capacity >= 2),
  member_count integer not null default 0 check (member_count >= 0),
  yes_total integer not null default 0 check (yes_total >= 0),
  no_total integer not null default 0 check (no_total >= 0),
  status public.pool_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (market_id, index)
);

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  pool_id uuid not null references public.pools (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  side public.bet_side not null,
  stake integer not null check (stake in (1, 5, 10, 25)),
  price_at_bet numeric(5, 4) not null check (price_at_bet > 0 and price_at_bet < 1),
  status public.bet_status not null default 'active',
  payout integer check (payout is null or payout >= 0),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index bets_market_created_idx on public.bets (market_id, created_at desc);
create index bets_market_user_idx on public.bets (market_id, user_id);
create index bets_user_created_idx on public.bets (user_id, created_at desc);
create index bets_pool_idx on public.bets (pool_id, status);

create table public.market_settlements (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  pool_id uuid not null unique references public.pools (id) on delete cascade,
  kind public.settlement_kind not null,
  outcome public.bet_side,
  total integer not null check (total >= 0),
  house_take integer not null check (house_take >= 0),
  distributable integer not null check (distributable >= 0),
  paid_out integer not null check (paid_out >= 0),
  dust integer generated always as (total - house_take - paid_out) stored,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint settlements_balance check (house_take + paid_out <= total)
);
create index market_settlements_market_idx on public.market_settlements (market_id);

-- ---------------------------------------------------------------------------
-- Social
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  like_count integer not null default 0,
  deleted_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index comments_market_created_idx on public.comments (market_id, created_at);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index comments_user_created_idx on public.comments (user_id, created_at desc);

create table public.market_likes (
  market_id uuid not null references public.markets (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (market_id, user_id)
);
create index market_likes_user_idx on public.market_likes (user_id);

create table public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user_idx on public.comment_likes (user_id);

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.swipe_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  market_id uuid not null references public.markets (id) on delete cascade,
  action public.swipe_action not null,
  dwell_ms integer check (dwell_ms is null or dwell_ms between 0 and 3600000),
  created_at timestamptz not null default now()
);
create index swipe_events_user_market_idx on public.swipe_events (user_id, market_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS and the functions)
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and banned_at is null
  );
$$;

create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin') and banned_at is null
  );
$$;

create function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and banned_at is not null
  );
$$;

-- Implied YES probability shown on cards: (yes + v) / (yes + no + 2v), v = 50.
create function public.implied_yes(p_yes integer, p_no integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round((p_yes + 50)::numeric / (p_yes + p_no + 100), 4);
$$;

-- Raise a stable error code; the client maps codes to toasts.
create function private.fail(p_code text, p_hint text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_code using errcode = 'P0001', hint = coalesce(p_hint, p_code);
end;
$$;

create function private.is_seeding()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('bav.seeding', true), '') = 'on';
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- profiles.balance changes only inside post_ledger.
create function private.guard_profile_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.balance <> 0 then
      perform private.fail('balance_write_forbidden', 'New profiles start at 0; coins arrive through the ledger');
    end if;
  elsif new.balance is distinct from old.balance
        and coalesce(current_setting('bav.ledger_write', true), '') <> 'on' then
    perform private.fail('balance_write_forbidden', 'profiles.balance is written only by post_ledger');
  end if;
  return new;
end;
$$;
create trigger profiles_guard_balance
  before insert or update of balance on public.profiles
  for each row execute function private.guard_profile_balance();

-- The ledger is append-only.
create function private.ledger_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.fail('ledger_append_only', 'Ledger rows cannot be updated');
  return null;
end;
$$;
create trigger ledger_no_update
  before update on public.ledger
  for each row execute function private.ledger_append_only();

-- Market insert rules for signed-in users: close at least 10 minutes out, rate limit.
create function private.before_market_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.is_seeding() then
    if new.closes_at < now() + interval '10 minutes' then
      perform private.fail('closes_too_soon', 'Markets must close at least 10 minutes from now');
    end if;
    if (
      select count(*) from public.markets
      where creator_id = auth.uid() and created_at > now() - interval '1 minute'
    ) >= 3 then
      perform private.fail('rate_limited', 'Too many new markets. Try again in a minute');
    end if;
  end if;
  return new;
end;
$$;
create trigger markets_before_insert
  before insert on public.markets
  for each row execute function private.before_market_insert();

-- Every market starts with pool 0.
create function private.create_first_pool()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pools (market_id, index, capacity)
  values (new.id, 0, new.pool_capacity);
  return new;
end;
$$;
create trigger markets_create_first_pool
  after insert on public.markets
  for each row execute function private.create_first_pool();

-- Comments: one level of replies, same market, rate limit.
create function private.before_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.comments%rowtype;
begin
  new.body := btrim(new.body);
  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    if not found or v_parent.market_id <> new.market_id then
      perform private.fail('comment_parent_invalid', 'That comment is not on this market');
    end if;
    if v_parent.parent_id is not null then
      -- Replies to replies attach to the top-level comment.
      new.parent_id := v_parent.parent_id;
    end if;
  end if;
  if auth.uid() is not null and not private.is_seeding() and (
    select count(*) from public.comments
    where user_id = auth.uid() and created_at > now() - interval '1 minute'
  ) >= 6 then
    perform private.fail('rate_limited', 'Slow down. Try again in a minute');
  end if;
  return new;
end;
$$;
create trigger comments_before_insert
  before insert on public.comments
  for each row execute function private.before_comment_insert();

-- Denormalized counters.
create function private.bump_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.markets set comment_count = comment_count + 1 where id = new.market_id;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      update public.markets set comment_count = greatest(comment_count - 1, 0) where id = old.market_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.markets set comment_count = greatest(comment_count - 1, 0) where id = new.market_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.markets set comment_count = comment_count + 1 where id = new.market_id;
    end if;
  end if;
  return null;
end;
$$;
create trigger comments_count
  after insert or delete or update of deleted_at on public.comments
  for each row execute function private.bump_comment_count();

create function private.bump_market_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.markets set like_count = like_count + 1 where id = new.market_id;
  else
    update public.markets set like_count = greatest(like_count - 1, 0) where id = old.market_id;
  end if;
  return null;
end;
$$;
create trigger market_likes_count
  after insert or delete on public.market_likes
  for each row execute function private.bump_market_like_count();

create function private.bump_comment_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;
create trigger comment_likes_count
  after insert or delete on public.comment_likes
  for each row execute function private.bump_comment_like_count();

create function private.bump_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set member_count = member_count + 1 where id = new.community_id;
  else
    update public.communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end;
$$;
create trigger community_members_count
  after insert or delete on public.community_members
  for each row execute function private.bump_member_count();
