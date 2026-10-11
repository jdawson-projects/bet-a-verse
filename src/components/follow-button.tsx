"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { errorMessage } from "@/lib/errors";
import { formatCoins } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function FollowButton({
  profileId,
  initiallyFollowing,
  followers,
}: {
  profileId: string;
  initiallyFollowing: boolean;
  followers: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const { userId } = useViewer();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [count, setCount] = useState(followers);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    setBusy(true);
    setFollowing(next);
    setCount((c) => c + (next ? 1 : -1));
    const supabase = getSupabaseBrowser();
    const { error } = next
      ? await supabase.from("follows").insert({ followee_id: profileId })
      : await supabase.from("follows").delete().eq("follower_id", userId).eq("followee_id", profileId);
    setBusy(false);
    if (error && error.code !== "23505") {
      setFollowing(!next);
      setCount((c) => c + (next ? -1 : 1));
      toast.show({ message: errorMessage(error), tone: "error" });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={`rounded-full px-5 py-2 text-sm font-bold transition ${
          following ? "bg-surface ring-1 ring-line hover:bg-surface-2" : "bg-brand text-white hover:bg-brand-strong"
        }`}
      >
        {following ? "Following" : "Follow"}
      </button>
      <span className="sr-only" aria-live="polite">
        {formatCoins(count)} followers
      </span>
    </div>
  );
}
