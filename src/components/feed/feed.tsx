"use client";

// The feed: data, optimistic betting, undo, prefetch. Gesture physics live in
// CardStack; card visuals in MarketCard.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardStack, type CardStackHandle, type SwipeDirection } from "@/components/card-stack/card-stack";
import { CheckIcon, SkipIcon, XIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { errorCode, errorMessage } from "@/lib/errors";
import { formatCoins } from "@/lib/format";
import {
  estimatePayout,
  formatPrice,
  impliedYes,
  payoutIfRight,
  yesShare,
  type Side,
  type Stake,
} from "@/lib/money";
import { marketUrl, shareLink } from "@/lib/share";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { nowMs, undoToastMs } from "@/lib/time";
import type { FeedCard } from "@/lib/types";
import { MarketCard } from "./market-card";
import { SwipeFeedback } from "./swipe-feedback";

const PAGE = 10;
const PREFETCH_AT = 5;
const REVEAL_MS = 1500;
/** Errors after which the card goes back on the stack so the user can try again. */
const RETRYABLE = new Set(["insufficient_balance", "rate_limited", "unknown", "stake_over_max"]);

interface Reveal {
  id: number;
  side: Side;
  price: number;
  estimate: number | null;
  share: number | null;
}

export function Feed({
  initialCards,
  initialNow,
  welcome,
}: {
  initialCards: FeedCard[];
  /** Server clock at render, so countdowns hydrate without a mismatch. */
  initialNow: number;
  welcome: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { balance, setBalance, defaultStake, userId } = useViewer();
  const [cards, setCards] = useState(initialCards);
  const [stake, setStakeState] = useState<Stake>(defaultStake);
  const [exhausted, setExhausted] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [now, setNow] = useState(initialNow);
  const stack = useRef<CardStackHandle>(null);
  const seen = useRef(new Set(initialCards.map((c) => c.id)));
  const fetching = useRef(false);
  const inflight = useRef(0);
  const topShownAt = useRef(0);
  const revealId = useRef(0);
  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // One clock for every countdown on screen.
  useEffect(() => {
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(t);
  }, []);

  // Toasts go to the top of the feed so they never cover the stake pill or the bet buttons.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--toast-top", "calc(env(safe-area-inset-top) + var(--header-h) + 10px)");
    root.style.setProperty("--toast-bottom", "auto");
    return () => {
      root.style.removeProperty("--toast-top");
      root.style.removeProperty("--toast-bottom");
    };
  }, []);

  useEffect(() => {
    if (!welcome) return;
    toast.show({ id: "welcome", message: "Welcome! You've got 1,000 coins to start. Swipe away.", tone: "success", duration: 4000 });
    router.replace("/", { scroll: false });
  }, [welcome, toast, router]);

  const topId = cards[0]?.id;
  useEffect(() => {
    topShownAt.current = performance.now();
  }, [topId]);

  // Prefetch the next page when five cards remain.
  const prefetch = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    const { data, error } = await getSupabaseBrowser().rpc("get_feed", {
      p_limit: PAGE,
      p_exclude: [...seen.current],
    });
    fetching.current = false;
    if (error || !data) return;
    const fresh = data.filter((c) => !seen.current.has(c.id));
    for (const c of fresh) seen.current.add(c.id);
    if (fresh.length) setCards((cs) => [...cs, ...fresh]);
    if (data.length < PAGE) setExhausted(true);
  }, []);

  useEffect(() => {
    if (cards.length <= PREFETCH_AT && !exhausted) {
      const t = setTimeout(prefetch, 0);
      return () => clearTimeout(t);
    }
  }, [cards.length, exhausted, prefetch]);

  const showReveal = useCallback((r: Omit<Reveal, "id">) => {
    const id = ++revealId.current;
    setReveal({ ...r, id });
    setTimeout(() => setReveal((cur) => (cur?.id === id ? null : cur)), REVEAL_MS);
    return id;
  }, []);

  const undo = useCallback(
    async (betId: string, card: FeedCard, betStake: number) => {
      const { data, error } = await getSupabaseBrowser().rpc("cancel_bet", { p_bet_id: betId }).single();
      if (error || !data) {
        toast.show({ message: errorMessage(error), tone: "error" });
        return;
      }
      setBalance(data.balance - inflight.current);
      setCards((cs) => [{ ...card, yes_total: data.yes_total, no_total: data.no_total }, ...cs.filter((c) => c.id !== card.id)]);
      toast.show({ message: `Undone. ${betStake} coin${betStake === 1 ? "" : "s"} back.` });
    },
    [setBalance, toast],
  );

  const placeBet = useCallback(
    async (card: FeedCard, side: Side, dwell: number) => {
      const betStake = stake;
      const startedAt = nowMs();
      if (betStake > card.max_stake || betStake > balanceRef.current) {
        toast.show({
          message: betStake > card.max_stake ? `Max stake on this one is ${card.max_stake}` : "Not enough coins for that stake",
          tone: "error",
        });
        setCards((cs) => [card, ...cs]);
        return;
      }
      navigator.vibrate?.(12);
      inflight.current += betStake;
      setBalance((b) => b - betStake);
      const p = impliedYes(card.yes_total, card.no_total);
      const id = showReveal({
        side,
        price: side === "yes" ? p : 1 - p,
        estimate: estimatePayout({ yesTotal: card.yes_total, noTotal: card.no_total, side, stake: betStake, rakeBps: card.rake_bps }),
        share: null,
      });

      const { data, error } = await getSupabaseBrowser()
        .rpc("place_bet", { p_market_id: card.id, p_side: side, p_stake: betStake, p_dwell_ms: dwell })
        .single();
      inflight.current -= betStake;

      if (error || !data) {
        setBalance((b) => b + betStake);
        setReveal((cur) => (cur?.id === id ? null : cur));
        toast.show({ message: errorMessage(error), tone: "error" });
        if (RETRYABLE.has(errorCode(error))) setCards((cs) => [card, ...cs.filter((c) => c.id !== card.id)]);
        return;
      }

      setBalance(data.balance - inflight.current);
      setReveal((cur) =>
        cur?.id === id
          ? {
              ...cur,
              share: yesShare(data.pool_yes_bettors, data.pool_no_bettors),
              estimate: payoutIfRight({
                yesTotal: data.pool_yes_total,
                noTotal: data.pool_no_total,
                side,
                stake: betStake,
                rakeBps: card.rake_bps,
              }),
            }
          : cur,
      );
      const remaining = undoToastMs(startedAt);
      if (remaining) {
        toast.show({
          id: "undo",
          message: `Bet placed · ${betStake} on ${side.toUpperCase()}`,
          duration: remaining,
          action: { label: "Undo", onClick: () => void undo(data.bet_id, card, betStake) },
        });
      }
    },
    [stake, setBalance, showReveal, toast, undo],
  );

  const onSwipe = useCallback(
    (card: FeedCard, dir: SwipeDirection) => {
      const dwell = Math.max(0, Math.round(performance.now() - topShownAt.current));
      setCards((cs) => cs.filter((c) => c.id !== card.id));
      if (dir === "up") {
        void getSupabaseBrowser()
          .from("swipe_events")
          .insert({ market_id: card.id, action: "skip", dwell_ms: Math.min(dwell, 3_600_000) })
          .then(() => {});
        return;
      }
      void placeBet(card, dir === "right" ? "yes" : "no", Math.min(dwell, 3_600_000));
    },
    [placeBet],
  );

  const setStake = useCallback(
    (s: Stake) => {
      setStakeState(s);
      // Remember it as the profile default (best effort).
      void getSupabaseBrowser().from("profiles").update({ default_stake: s }).eq("id", userId).then(() => {});
    },
    [userId],
  );

  const onLike = useCallback(
    async (card: FeedCard) => {
      const liked = !card.liked;
      const patch = (c: FeedCard) =>
        c.id === card.id ? { ...c, liked, like_count: Math.max(0, c.like_count + (liked ? 1 : -1)) } : c;
      setCards((cs) => cs.map(patch));
      const supabase = getSupabaseBrowser();
      const { error } = liked
        ? await supabase.from("market_likes").insert({ market_id: card.id })
        : await supabase.from("market_likes").delete().eq("market_id", card.id).eq("user_id", userId);
      if (error && error.code !== "23505") {
        setCards((cs) => cs.map((c) => (c.id === card.id ? card : c)));
        toast.show({ message: errorMessage(error), tone: "error" });
      }
    },
    [toast, userId],
  );

  const onShare = useCallback(
    async (card: FeedCard) => {
      const result = await shareLink(marketUrl(card.id), card.question);
      if (result === "copied") toast.show({ message: "Link copied" });
      if (result === "failed") toast.show({ message: "Couldn't share that link", tone: "error" });
    },
    [toast],
  );

  // Keyboard: ← NO, → YES, ↑ skip, 1–4 stake.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable]")) return;
      const dir = ({ ArrowRight: "right", ArrowLeft: "left", ArrowUp: "up" } as const)[e.key as string];
      if (dir) {
        e.preventDefault();
        stack.current?.swipe(dir);
        return;
      }
      const s = ({ "1": 1, "2": 5, "3": 10, "4": 25 } as const)[e.key as string];
      if (s) setStake(s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setStake]);

  const top = cards[0];
  const empty = cards.length === 0;

  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col px-3 pt-3"
      style={{
        height: "calc(100dvh - var(--header-h) - var(--nav-h) - env(safe-area-inset-bottom) - env(safe-area-inset-top))",
        minHeight: 540,
      }}
    >
      <div className="relative min-h-0 flex-1">
        {empty ? (
          <EmptyState loading={!exhausted} />
        ) : (
          <CardStack
            ref={stack}
            className="absolute inset-0"
            items={cards}
            getKey={(c) => c.id}
            onSwipe={onSwipe}
            renderFeedback={(m) => <SwipeFeedback {...m} />}
            renderCard={(card, { isTop }) => (
              <MarketCard
                card={card}
                stake={stake}
                balance={balance}
                now={now}
                isTop={isTop}
                onStakeChange={setStake}
                onLike={onLike}
                onShare={onShare}
              />
            )}
          />
        )}
        <div className="pointer-events-none absolute inset-x-4 top-[38%] z-[200] flex justify-center" aria-live="polite">
          <AnimatePresence>
            {reveal && (
              <motion.div
                key={reveal.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="max-w-full rounded-2xl bg-black/80 px-4 py-3 text-center text-[15px] font-semibold leading-snug text-white shadow-2xl ring-1 ring-white/15 backdrop-blur"
              >
                <span className={`font-black ${reveal.side === "yes" ? "text-emerald-300" : "text-rose-300"}`}>
                  You: {reveal.side.toUpperCase()} at {formatPrice(reveal.price)}
                </span>
                {reveal.share !== null && (
                  <>
                    {" · "}
                    {reveal.side === "yes" ? reveal.share : 100 - reveal.share}% of this pool says {reveal.side.toUpperCase()}
                  </>
                )}
                {" · "}
                {reveal.estimate === null
                  ? `no one on ${reveal.side === "yes" ? "NO" : "YES"} yet`
                  : `~${formatCoins(reveal.estimate)} coins if you're right`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 py-3">
        <button
          type="button"
          onClick={() => stack.current?.swipe("left")}
          disabled={!top}
          aria-label="Bet NO"
          className="flex h-14 items-center justify-center gap-1.5 rounded-full bg-no text-lg font-black text-white shadow-md transition active:scale-95 disabled:opacity-40"
        >
          <XIcon /> NO
        </button>
        <button
          type="button"
          onClick={() => stack.current?.swipe("up")}
          disabled={!top}
          aria-label="Skip"
          className="flex h-14 w-16 flex-col items-center justify-center rounded-full bg-surface text-[11px] font-bold text-muted shadow-sm ring-1 ring-line transition active:scale-95 disabled:opacity-40"
        >
          <SkipIcon />
          Skip
        </button>
        <button
          type="button"
          onClick={() => stack.current?.swipe("right")}
          disabled={!top}
          aria-label="Bet YES"
          className="flex h-14 items-center justify-center gap-1.5 rounded-full bg-yes text-lg font-black text-white shadow-md transition active:scale-95 disabled:opacity-40"
        >
          <CheckIcon /> YES
        </button>
      </div>
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div className="grid h-full place-items-center rounded-[28px] bg-surface ring-1 ring-line">
        <p className="animate-pulse text-muted">Loading more markets…</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[28px] bg-surface px-8 text-center ring-1 ring-line">
      <div className="text-5xl" aria-hidden>
        🃏
      </div>
      <h2 className="text-2xl font-black tracking-tight">You&apos;ve swiped everything</h2>
      <p className="text-muted">New markets drop all the time. Start one yourself, or find your people.</p>
      <div className="flex gap-3">
        <Link href="/create" className="rounded-full bg-brand px-5 py-3 font-bold text-white">
          Create a market
        </Link>
        <Link href="/c" className="rounded-full bg-surface-2 px-5 py-3 font-bold ring-1 ring-line">
          Communities
        </Link>
      </div>
    </div>
  );
}
