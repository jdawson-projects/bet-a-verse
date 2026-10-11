import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { CoinIcon } from "@/components/balance";
import { FollowButton } from "@/components/follow-button";
import { SideBadge } from "@/components/side-badge";
import { formatCoins, timeAgo } from "@/lib/format";
import { formatPrice, payoutIfRight, sidePrice } from "@/lib/money";
import { requireViewer } from "@/lib/viewer";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}` };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ username: raw }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const username = decodeURIComponent(raw).toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) notFound();
  const tab = rawTab === "markets" ? "markets" : "picks";
  const { supabase, userId } = await requireViewer();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, balance, role, created_at, banned_at")
    .eq("username", username)
    .maybeSingle();
  if (!profile) notFound();
  const isMe = profile.id === userId;

  const [{ data: stats }, { data: memberships }, { data: followRow }, list] = await Promise.all([
    supabase.rpc("get_profile_stats", { p_user_id: profile.id }).single(),
    supabase.from("community_members").select("community:communities(slug, name)").eq("user_id", profile.id),
    supabase.from("follows").select("followee_id").eq("follower_id", userId).eq("followee_id", profile.id).maybeSingle(),
    tab === "picks"
      ? supabase
          .from("bets")
          .select("id, side, stake, status, payout, price_at_bet, created_at, market:markets(id, question, status, outcome, yes_total, no_total, rake_bps)")
          .eq("user_id", profile.id)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(60)
      : supabase
          .from("markets")
          .select("id, question, status, outcome, yes_total, no_total, bet_count, created_at")
          .eq("creator_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(60),
  ]);

  const communities = (memberships ?? []).flatMap((m) => (m.community ? [m.community] : []));
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
      <header className="flex items-start gap-4">
        <Avatar username={profile.username ?? "?"} src={profile.avatar_url} size={72} />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-2xl font-black tracking-tight">{profile.display_name || `@${profile.username}`}</h1>
          <p className="text-muted">
            @{profile.username}
            {profile.role !== "user" && (
              <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold capitalize text-brand">{profile.role}</span>
            )}
            {profile.banned_at && <span className="ml-2 rounded-full bg-no-soft px-2 py-0.5 text-xs font-bold text-no-strong">Suspended</span>}
          </p>
          {profile.bio && <p className="text-[15px]">{profile.bio}</p>}
          <p className="text-sm text-muted">
            <strong className="text-fg tabular">{formatCoins(stats?.followers ?? 0)}</strong> followers ·{" "}
            <strong className="text-fg tabular">{formatCoins(stats?.following ?? 0)}</strong> following · joined {timeAgo(profile.created_at)}
          </p>
          <div className="pt-2">
            {isMe ? (
              <form action="/auth/signout" method="post">
                <button type="submit" className="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-line hover:bg-surface-2">
                  Sign out
                </button>
              </form>
            ) : (
              <FollowButton profileId={profile.id} initiallyFollowing={Boolean(followRow)} followers={stats?.followers ?? 0} />
            )}
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Coins" value={<span className="flex items-center gap-1.5"><CoinIcon className="h-5 w-5" />{formatCoins(profile.balance)}</span>} />
        <StatCard label="Record" value={`${wins}–${losses}`} />
        <StatCard label="Win rate" value={stats?.win_rate == null ? "—" : `${Math.round(Number(stats.win_rate) * 100)}%`} />
        <StatCard label="Streak" value={`${stats?.current_streak ?? 0}`} sub={`best ${stats?.best_streak ?? 0}`} />
      </dl>

      {communities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {communities.map((c) => (
            <span key={c.slug} className="rounded-full bg-surface px-3 py-1 text-sm font-semibold ring-1 ring-line">
              #{c.slug}
            </span>
          ))}
        </div>
      )}

      <nav aria-label="Profile sections" className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
        {(["picks", "markets"] as const).map((t) => (
          <Link
            key={t}
            href={t === "picks" ? `/u/${profile.username}` : `/u/${profile.username}?tab=markets`}
            aria-current={tab === t ? "page" : undefined}
            className="flex-1 rounded-full py-2 text-center text-sm font-bold text-muted transition aria-[current=page]:bg-fg aria-[current=page]:text-bg"
            scroll={false}
          >
            {t === "picks" ? "Picks" : "Markets created"}
          </Link>
        ))}
      </nav>

      {tab === "picks" ? (
        <PickList picks={(list.data ?? []) as Pick[]} />
      ) : (
        <MarketList markets={(list.data ?? []) as Created[]} />
      )}
    </div>
  );
}

interface Pick {
  id: string;
  side: "yes" | "no";
  stake: number;
  status: "active" | "won" | "lost" | "refunded" | "cancelled";
  payout: number | null;
  price_at_bet: number;
  created_at: string;
  market: { id: string; question: string; status: string; outcome: "yes" | "no" | null; yes_total: number; no_total: number; rake_bps: number } | null;
}

interface Created {
  id: string;
  question: string;
  status: string;
  outcome: "yes" | "no" | null;
  yes_total: number;
  no_total: number;
  bet_count: number;
  created_at: string;
}

function PickList({ picks }: { picks: Pick[] }) {
  if (picks.length === 0) return <Empty text="No picks yet." />;
  return (
    <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
      {picks.map((p) => {
        const m = p.market;
        const est =
          p.status === "active" && m
            ? payoutIfRight({ yesTotal: m.yes_total, noTotal: m.no_total, side: p.side, stake: p.stake, rakeBps: m.rake_bps })
            : null;
        return (
          <li key={p.id}>
            <Link href={m ? `/m/${m.id}` : "#"} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
              <SideBadge side={p.side} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m?.question ?? "Deleted market"}</p>
                <p className="text-xs text-muted tabular">
                  {p.stake} coins at {formatPrice(sidePrice(Number(p.price_at_bet), p.side))} · {timeAgo(p.created_at)}
                </p>
              </div>
              <span className="shrink-0 text-right text-sm font-bold tabular">
                {p.status === "won" ? (
                  <span className="text-yes-strong">+{formatCoins(p.payout ?? 0)}</span>
                ) : p.status === "lost" ? (
                  <span className="text-no-strong">−{p.stake}</span>
                ) : p.status === "refunded" ? (
                  <span className="text-muted">refunded</span>
                ) : (
                  <span className="text-muted">{est === null ? "open" : `~${formatCoins(est)}`}</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MarketList({ markets }: { markets: Created[] }) {
  if (markets.length === 0) return <Empty text="No markets created yet." />;
  return (
    <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
      {markets.map((m) => (
        <li key={m.id}>
          <Link href={`/m/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{m.question}</p>
              <p className="text-xs text-muted tabular">
                {formatCoins(m.yes_total + m.no_total)} coins · {m.bet_count} bets · {timeAgo(m.created_at)}
              </p>
            </div>
            {m.status === "resolved" && m.outcome ? (
              <SideBadge side={m.outcome} />
            ) : (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold capitalize text-muted">{m.status}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 ring-1 ring-line">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-black tabular">{value}</dd>
      {sub && <dd className="text-xs text-muted">{sub}</dd>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-3xl bg-surface px-4 py-8 text-center text-muted ring-1 ring-line">{text}</p>;
}
