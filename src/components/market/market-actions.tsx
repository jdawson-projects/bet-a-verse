"use client";

import { useState } from "react";
import { HeartIcon, ShareIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { errorMessage } from "@/lib/errors";
import { formatCoins } from "@/lib/format";
import { marketUrl, shareLink } from "@/lib/share";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function MarketActions({
  marketId,
  question,
  likeCount,
  liked: initiallyLiked,
  shareText,
  shareLabel = "Share",
}: {
  marketId: string;
  question: string;
  likeCount: number;
  liked: boolean;
  shareText?: string;
  shareLabel?: string;
}) {
  const toast = useToast();
  const { userId } = useViewer();
  const [liked, setLiked] = useState(initiallyLiked);
  const [count, setCount] = useState(likeCount);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const supabase = getSupabaseBrowser();
    const { error } = next
      ? await supabase.from("market_likes").insert({ market_id: marketId })
      : await supabase.from("market_likes").delete().eq("market_id", marketId).eq("user_id", userId);
    if (error && error.code !== "23505") {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast.show({ message: errorMessage(error), tone: "error" });
    }
  }

  async function share() {
    const r = await shareLink(marketUrl(marketId), shareText ?? question);
    if (r === "copied") toast.show({ message: "Link copied" });
    if (r === "failed") toast.show({ message: "Couldn't share that link", tone: "error" });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={toggleLike}
        aria-pressed={liked}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ring-1 transition ${
          liked ? "bg-no-soft text-no-strong ring-no/30" : "bg-surface ring-line hover:bg-surface-2"
        }`}
      >
        <HeartIcon className="h-4 w-4" filled={liked} />
        <span className="tabular">{formatCoins(count)}</span>
        <span className="sr-only">{liked ? "Unlike" : "Like"}</span>
      </button>
      <button
        type="button"
        onClick={share}
        className="flex items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-sm font-bold ring-1 ring-line transition hover:bg-surface-2"
      >
        <ShareIcon className="h-4 w-4" />
        {shareLabel}
      </button>
    </div>
  );
}
