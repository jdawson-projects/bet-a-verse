"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function JoinButton({ communityId, joined: initiallyJoined }: { communityId: string; joined: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { userId } = useViewer();
  const [joined, setJoined] = useState(initiallyJoined);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const supabase = getSupabaseBrowser();
    const { error } = joined
      ? await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", userId)
      : await supabase.from("community_members").insert({ community_id: communityId });
    setBusy(false);
    if (error && error.code !== "23505") return toast.show({ message: errorMessage(error), tone: "error" });
    setJoined(!joined);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={joined}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
        joined ? "ring-1 ring-line hover:bg-surface-2" : "bg-brand text-white hover:bg-brand-strong"
      }`}
    >
      {joined ? "Leave" : "Join"}
    </button>
  );
}
