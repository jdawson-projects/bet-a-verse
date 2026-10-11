"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalTime } from "@/components/local-time";
import { ResolvePanel } from "@/components/market/resolve-panel";
import { SideBadge } from "@/components/side-badge";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { formatCoins } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface AdminMarket {
  id: string;
  question: string;
  status: "open" | "closed" | "resolved" | "voided";
  outcome: "yes" | "no" | null;
  closes_at: string;
  resolves_by: string;
  yes_total: number;
  no_total: number;
  bet_count: number;
  featured_at: string | null;
  creator: string | null;
  /** Past resolves_by and still unsettled (computed on the server). */
  overdue: boolean;
}

export function AdminMarketRow({ market }: { market: AdminMarket }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [featured, setFeatured] = useState(Boolean(market.featured_at));
  const settled = market.status === "resolved" || market.status === "voided";

  async function toggleFeatured() {
    const next = !featured;
    setFeatured(next);
    const { error } = await getSupabaseBrowser().rpc("set_market_featured", { p_market_id: market.id, p_featured: next });
    if (error) {
      setFeatured(!next);
      toast.show({ message: errorMessage(error), tone: "error" });
    } else {
      router.refresh();
    }
  }

  return (
    <li className="space-y-3 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/m/${market.id}`} className="font-semibold hover:underline">
            {market.question}
          </Link>
          <p className="mt-0.5 text-xs text-muted tabular">
            {market.creator ? `@${market.creator} · ` : ""}
            {formatCoins(market.yes_total + market.no_total)} coins · {market.bet_count} bets · closes <LocalTime iso={market.closes_at} /> ·
            resolve by <LocalTime iso={market.resolves_by} />
            {market.overdue && <span className="ml-1 font-bold text-no-strong">overdue</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {market.status === "resolved" && market.outcome ? (
            <SideBadge side={market.outcome} />
          ) : (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold capitalize">{market.status}</span>
          )}
          {!settled && (
            <button
              type="button"
              onClick={toggleFeatured}
              aria-pressed={featured}
              className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${featured ? "bg-coin text-white ring-coin" : "ring-line"}`}
            >
              {featured ? "Featured" : "Feature"}
            </button>
          )}
          {!settled && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-full bg-fg px-3 py-1 text-xs font-bold text-bg">
              {open ? "Close" : "Resolve"}
            </button>
          )}
        </div>
      </div>
      {open && <ResolvePanel marketId={market.id} canVoid compact onDone={() => setOpen(false)} />}
    </li>
  );
}

export function AdminCommentRow({
  comment,
}: {
  comment: { id: string; body: string; author: string; marketId: string; question: string; created_at: string };
}) {
  const toast = useToast();
  const [deleted, setDeleted] = useState(false);
  async function remove() {
    const { error } = await getSupabaseBrowser().rpc("delete_comment", { p_comment_id: comment.id });
    if (error) return toast.show({ message: errorMessage(error), tone: "error" });
    setDeleted(true);
  }
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] ${deleted ? "italic text-muted line-through" : ""}`}>{comment.body}</p>
        <p className="mt-0.5 text-xs text-muted">
          @{comment.author} on{" "}
          <Link href={`/m/${comment.marketId}#comments`} className="underline-offset-2 hover:underline">
            {comment.question}
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={deleted}
        className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-no-strong ring-1 ring-no/40 disabled:opacity-40"
      >
        {deleted ? "Deleted" : "Delete"}
      </button>
    </li>
  );
}

export function AdminUserRow({
  user,
  canBan,
  isSelf,
}: {
  user: { id: string; username: string | null; role: string; balance: number; banned_at: string | null };
  canBan: boolean;
  isSelf: boolean;
}) {
  const toast = useToast();
  const [banned, setBanned] = useState(Boolean(user.banned_at));
  async function toggle() {
    const next = !banned;
    const { error } = await getSupabaseBrowser().rpc("set_user_banned", { p_user_id: user.id, p_banned: next });
    if (error) return toast.show({ message: errorMessage(error), tone: "error" });
    setBanned(next);
    toast.show({ message: next ? `@${user.username} is banned` : `@${user.username} is unbanned` });
  }
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <Link href={user.username ? `/u/${user.username}` : "#"} className="font-semibold hover:underline">
          @{user.username ?? "(no username)"}
        </Link>
        <p className="text-xs text-muted tabular">
          {user.role} · {formatCoins(user.balance)} coins
        </p>
      </div>
      {banned && <span className="rounded-full bg-no-soft px-2 py-0.5 text-xs font-bold text-no-strong">Banned</span>}
      {canBan && !isSelf && (
        <button
          type="button"
          onClick={toggle}
          className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${banned ? "ring-line" : "text-no-strong ring-no/40"}`}
        >
          {banned ? "Unban" : "Ban"}
        </button>
      )}
    </li>
  );
}
