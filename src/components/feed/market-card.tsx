"use client";

import Link from "next/link";
import { ClockIcon, CommentIcon, FlameIcon, HeartIcon, ShareIcon } from "@/components/icons";
import { CATEGORY_GRADIENTS } from "@/components/market/category";
import { PricePills, SplitBar } from "@/components/market/price";
import { CATEGORY_LABELS, closesIn, formatCoins } from "@/lib/format";
import { StakePill } from "@/components/stake-pill";
import { estimatePayout, type Stake } from "@/lib/money";
import type { FeedCard } from "@/lib/types";

export interface MarketCardProps {
  card: FeedCard;
  stake: Stake;
  balance: number;
  now: number;
  isTop: boolean;
  onStakeChange: (s: Stake) => void;
  onLike: (card: FeedCard) => void;
  onShare: (card: FeedCard) => void;
}

// Rail buttons must not start a card drag.
const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

function Estimate({ card, stake }: { card: FeedCard; stake: number }) {
  const args = { yesTotal: card.yes_total, noTotal: card.no_total, stake, rakeBps: card.rake_bps };
  const yes = estimatePayout({ ...args, side: "yes" });
  const no = estimatePayout({ ...args, side: "no" });
  const fresh = card.yes_total === 0 && card.no_total === 0;
  // An estimate needs coins on the other side; without them there's nothing to win yet.
  const line = (label: "YES" | "NO", v: number | null) => (
    <span>
      <strong>{label}</strong>:{" "}
      {v === null ? `no one on ${label === "YES" ? "NO" : "YES"} yet` : `~${formatCoins(v)} coins if you're right`}
    </span>
  );
  return (
    <div className="space-y-0.5 text-[13px] leading-snug text-white/85">
      {fresh ? (
        <p className="text-base font-bold text-white">Be the first to call it</p>
      ) : (
        <div className="flex flex-col">
          {line("YES", yes)}
          {line("NO", no)}
        </div>
      )}
      <p className="text-[11px] text-white/60">
        {fresh ? "No bets yet. " : `Estimate for ${stake} coin${stake === 1 ? "" : "s"}. `}Odds move until close.
      </p>
    </div>
  );
}

export function MarketCard({ card, stake, balance, now, isTop, onStakeChange, onLike, onShare }: MarketCardProps) {
  const pot = card.yes_total + card.no_total;
  return (
    <article
      aria-label={card.question}
      className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] p-5 text-white shadow-[0_18px_40px_-12px_rgba(10,14,40,0.45)]"
      style={{ background: CATEGORY_GRADIENTS[card.category] }}
    >
      <div className="flex items-center gap-2 text-xs font-bold">
        <span className="rounded-full bg-white/18 px-2.5 py-1 uppercase tracking-wider backdrop-blur">
          {CATEGORY_LABELS[card.category]}
        </span>
        {card.community_slug && (
          <span className="truncate rounded-full bg-black/20 px-2.5 py-1">#{card.community_slug}</span>
        )}
        {card.featured && <span className="rounded-full bg-coin px-2.5 py-1 text-white">Featured</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 tabular">
          <ClockIcon className="h-3.5 w-3.5" />
          <span className="sr-only">Closes in</span>
          {closesIn(card.closes_at, now)}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center pr-12">
        <h2 className="text-balance text-[clamp(1.6rem,6.5vw,2.15rem)] font-black leading-[1.12] tracking-tight">
          {card.question}
        </h2>
        {card.creator_username && <p className="mt-3 text-sm text-white/65">by @{card.creator_username}</p>}
      </div>

      <div className="space-y-3 pr-12">
        <PricePills yes={card.yes_total} no={card.no_total} />
        <SplitBar yes={card.yes_total} no={card.no_total} className="bg-white/20" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-white/90">
          <span className="tabular">{formatCoins(pot)} coins in the pot</span>
          {card.bets_last_minute > 0 ? (
            <span className="flex items-center gap-1 text-amber-200 tabular">
              <FlameIcon /> {card.bets_last_minute} bet{card.bets_last_minute === 1 ? "" : "s"} in the last minute
            </span>
          ) : (
            <span className="tabular text-white/70">
              {formatCoins(card.bet_count)} bet{card.bet_count === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <Estimate card={card} stake={stake} />
        <div onPointerDown={stopDrag} className="w-fit" inert={!isTop}>
          <StakePill value={stake} onChange={onStakeChange} max={card.max_stake} balance={balance} tone="onDark" />
        </div>
      </div>

      <div className="absolute bottom-40 right-3 flex flex-col items-center gap-4" inert={!isTop}>
        <button
          type="button"
          onPointerDown={stopDrag}
          onClick={() => onLike(card)}
          aria-pressed={card.liked}
          aria-label={card.liked ? "Unlike" : "Like"}
          className="flex flex-col items-center gap-0.5 text-xs font-bold"
        >
          <span className={`grid h-11 w-11 place-items-center rounded-full bg-black/25 backdrop-blur transition ${card.liked ? "text-rose-300" : ""}`}>
            <HeartIcon filled={card.liked} />
          </span>
          <span className="tabular">{formatCoins(card.like_count)}</span>
        </button>
        <Link
          href={`/m/${card.id}#comments`}
          onPointerDown={stopDrag}
          aria-label={`${card.comment_count} comments`}
          className="flex flex-col items-center gap-0.5 text-xs font-bold"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/25 backdrop-blur">
            <CommentIcon />
          </span>
          <span className="tabular">{formatCoins(card.comment_count)}</span>
        </Link>
        <button
          type="button"
          onPointerDown={stopDrag}
          onClick={() => onShare(card)}
          aria-label="Share"
          className="flex flex-col items-center gap-0.5 text-xs font-bold"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-black/25 backdrop-blur">
            <ShareIcon />
          </span>
          <span>Share</span>
        </button>
      </div>
    </article>
  );
}
