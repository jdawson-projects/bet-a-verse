import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Countdown } from "@/components/countdown";
import { ArrowLeftIcon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { BetPanel } from "@/components/market/bet-panel";
import { Comments, type CommentView } from "@/components/market/comments";
import { MarketActions, ShareButton } from "@/components/market/market-actions";
import { PricePills, SplitBar } from "@/components/market/price";
import { ResolvePanel } from "@/components/market/resolve-panel";
import { SideBadge } from "@/components/side-badge";
import { CATEGORY_LABELS, formatCoins, timeAgo } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { formatPrice, payoutIfRight, sidePrice } from "@/lib/money";
import { getSupabaseServer } from "@/lib/supabase/server";
import { nowMs } from "@/lib/time";
import { isStaff, requireViewer } from "@/lib/viewer";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return {};
  const supabase = await getSupabaseServer();
  const { data } = await supabase.from("markets").select("question").eq("id", id).maybeSingle();
  return data ? { title: data.question } : {};
}

export default async function MarketPage({ params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase, userId, profile } = await requireViewer();

  const { data: market } = await supabase
    .from("markets")
    .select(
      "*, community:communities(slug, name), creator:profiles!markets_creator_id_fkey(username, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!market) notFound();

  const [{ data: myBets }, { data: rawComments }, { data: likeRow }] = await Promise.all([
    supabase
      .from("bets")
      .select("id, side, stake, status, payout, price_at_bet, created_at")
      .eq("market_id", id)
      .eq("user_id", userId)
      .neq("status", "cancelled")
      .order("created_at"),
    supabase
      .from("comments")
      .select("id, parent_id, body, like_count, deleted_at, created_at, user_id, author:profiles!comments_user_id_fkey(username)")
      .eq("market_id", id)
      .order("created_at")
      .limit(500),
    supabase.from("market_likes").select("market_id").eq("market_id", id).eq("user_id", userId).maybeSingle(),
  ]);

  const comments = rawComments ?? [];
  const authorIds = [...new Set(comments.map((c) => c.user_id))];
  const commentIds = comments.map((c) => c.id);
  const [{ data: authorBets }, { data: myCommentLikes }] = await Promise.all([
    authorIds.length
      ? supabase.from("bets").select("user_id, side, stake").eq("market_id", id).neq("status", "cancelled").in("user_id", authorIds)
      : Promise.resolve({ data: [] as { user_id: string; side: "yes" | "no"; stake: number }[] }),
    commentIds.length
      ? supabase.from("comment_likes").select("comment_id").eq("user_id", userId).in("comment_id", commentIds)
      : Promise.resolve({ data: [] as { comment_id: string }[] }),
  ]);

  // Each author's side = the side they put more coins on.
  const stakeBySide = new Map<string, { yes: number; no: number }>();
  for (const b of authorBets ?? []) {
    const s = stakeBySide.get(b.user_id) ?? { yes: 0, no: 0 };
    s[b.side] += b.stake;
    stakeBySide.set(b.user_id, s);
  }
  const sideOf = (uid: string): "yes" | "no" | null => {
    const s = stakeBySide.get(uid);
    if (!s || s.yes + s.no === 0) return null;
    return s.yes >= s.no ? "yes" : "no";
  };
  const likedComments = new Set((myCommentLikes ?? []).map((l) => l.comment_id));
  const commentViews: CommentView[] = comments.map((c) => ({
    id: c.id,
    parent_id: c.parent_id,
    body: c.body,
    like_count: c.like_count,
    deleted_at: c.deleted_at,
    created_at: c.created_at,
    user_id: c.user_id,
    username: c.author?.username ?? "unknown",
    side: sideOf(c.user_id),
    liked: likedComments.has(c.id),
  }));

  const bets = myBets ?? [];
  const exposure = bets.filter((b) => b.status === "active").reduce((n, b) => n + b.stake, 0);
  const mySide = sideOf(userId) ?? (bets.length ? (bets[0].side as "yes" | "no") : null);
  const now = nowMs();
  const isOpen = market.status === "open" && new Date(market.closes_at).getTime() > now;
  const settled = market.status === "resolved" || market.status === "voided";
  const staff = isStaff(profile.role);
  const creatorCanResolve = market.creator_id === userId && bets.length === 0;
  const pot = market.yes_total + market.no_total;

  // Result after settlement.
  const won = bets.filter((b) => b.status === "won").reduce((n, b) => n + (b.payout ?? 0), 0);
  const lost = bets.filter((b) => b.status === "lost").reduce((n, b) => n + b.stake, 0);
  const refunded = bets.filter((b) => b.status === "refunded").reduce((n, b) => n + (b.payout ?? 0), 0);
  const result =
    won > 0
      ? { tone: "win" as const, text: `You won ${formatCoins(won)} coins`, share: `I called it on Bet-a-Verse and won ${won} coins:` }
      : lost > 0
        ? { tone: "loss" as const, text: `You lost ${formatCoins(lost)}`, share: `Took an L on Bet-a-Verse:` }
        : refunded > 0
          ? { tone: "refund" as const, text: `Refunded ${formatCoins(refunded)} coins`, share: undefined }
          : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeftIcon className="h-4 w-4" /> Feed
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-brand-soft px-2.5 py-1 uppercase tracking-wider text-brand">
            {CATEGORY_LABELS[market.category]}
          </span>
          {market.community && (
            <span className="rounded-full bg-surface-2 px-2.5 py-1">#{market.community.slug}</span>
          )}
          <StatusBadge status={market.status} outcome={market.outcome} open={isOpen} />
        </div>
        <h1 className="text-balance text-3xl font-black leading-tight tracking-tight sm:text-4xl">{market.question}</h1>
        {market.creator && (
          <Link href={`/u/${market.creator.username}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
            <Avatar username={market.creator.username ?? "?"} src={market.creator.avatar_url} size={22} />
            by @{market.creator.username} · {timeAgo(market.created_at)}
          </Link>
        )}
      </header>

      {settled && (
        <section
          className={`rounded-3xl p-5 ${
            market.status === "voided" ? "bg-surface-2" : market.outcome === "yes" ? "bg-yes text-white" : "bg-no text-white"
          }`}
        >
          <p className="text-sm font-bold uppercase tracking-wider opacity-80">
            {market.status === "voided" ? "Voided" : "Resolved"}
          </p>
          <p className="text-3xl font-black">
            {market.status === "voided" ? "All bets refunded" : `${market.outcome?.toUpperCase()} it is`}
          </p>
          {market.resolution_note && <p className="mt-2 text-sm opacity-90">{market.resolution_note}</p>}
          {market.resolution_proof_url && (
            <a href={market.resolution_proof_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block text-sm font-semibold underline">
              Proof
            </a>
          )}
          {result && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/15 px-4 py-3">
              <p className="text-xl font-black">{result.text}</p>
              {result.share && (
                <ShareButton marketId={market.id} text={`${result.share} "${market.question}"`} label="Share result" />
              )}
            </div>
          )}
        </section>
      )}

      <section className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
        <PricePills yes={market.yes_total} no={market.no_total} />
        <SplitBar yes={market.yes_total} no={market.no_total} className="bg-surface-2" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <Stat label="Pot" value={`${formatCoins(pot)} coins`} />
          <Stat label="Bets" value={formatCoins(market.bet_count)} />
          <Stat label="YES pot" value={formatCoins(market.yes_total)} />
          <Stat label="NO pot" value={formatCoins(market.no_total)} />
          <Stat
            label={isOpen ? "Closes in" : "Closed"}
            value={isOpen ? <Countdown iso={market.closes_at} initialNow={now} /> : <LocalTime iso={market.closes_at} />}
          />
          <Stat label="Resolves by" value={<LocalTime iso={market.resolves_by} />} />
          <Stat label="Max stake" value={`${market.max_stake} coins`} />
          <Stat label="Rake" value={`${market.rake_bps / 100}%`} />
        </dl>
        <MarketActions marketId={market.id} question={market.question} likeCount={market.like_count} liked={Boolean(likeRow)} />
      </section>

      {market.details && (
        <section className="space-y-1.5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">How it resolves</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{market.details}</p>
        </section>
      )}

      {bets.length > 0 && (
        <section className="space-y-2 rounded-3xl bg-surface p-5 ring-1 ring-line">
          <h2 className="font-black">Your position</h2>
          <ul className="divide-y divide-line">
            {bets.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <SideBadge side={b.side} />
                  <span className="font-semibold tabular">{b.stake} coins</span>
                  <span className="text-muted">at {formatPrice(sidePrice(Number(b.price_at_bet), b.side))}</span>
                </span>
                <span className="text-right font-semibold tabular">
                  {b.status === "active"
                    ? (() => {
                        const p = payoutIfRight({ yesTotal: market.yes_total, noTotal: market.no_total, side: b.side, stake: b.stake, rakeBps: market.rake_bps });
                        return p === null ? "waiting on the other side" : `~${formatCoins(p)} if right`;
                      })()
                    : b.status === "won"
                      ? <span className="text-yes-strong">Won {formatCoins(b.payout ?? 0)}</span>
                      : b.status === "lost"
                        ? <span className="text-no-strong">Lost {b.stake}</span>
                        : `Refunded ${formatCoins(b.payout ?? b.stake)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOpen && !profile.banned_at && (
        <BetPanel
          marketId={market.id}
          yesTotal={market.yes_total}
          noTotal={market.no_total}
          rakeBps={market.rake_bps}
          maxStake={market.max_stake}
          exposure={exposure}
        />
      )}

      {!settled && (staff || creatorCanResolve) && <ResolvePanel marketId={market.id} canVoid={staff} />}

      <Comments marketId={market.id} initial={commentViews} mySide={mySide} canModerate={staff} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="font-bold tabular">{value}</dd>
    </div>
  );
}

function StatusBadge({ status, outcome, open }: { status: string; outcome: "yes" | "no" | null; open: boolean }) {
  if (status === "resolved" && outcome) return <SideBadge side={outcome} className="!text-xs" />;
  const label = status === "voided" ? "Voided" : open ? "Open" : "Closed";
  return (
    <span className={`rounded-full px-2.5 py-1 ${open ? "bg-yes-soft text-yes-strong" : "bg-surface-2 text-muted"}`}>{label}</span>
  );
}
