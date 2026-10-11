import type { Metadata } from "next";
import { formatCoins } from "@/lib/format";
import { requireViewer } from "@/lib/viewer";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "Communities" };

// Phase 1 keeps this to a browse/join list; community pages and leaderboards are Phase 2.
export default async function CommunitiesPage() {
  const { supabase, userId } = await requireViewer();
  const [{ data: communities }, { data: mine }] = await Promise.all([
    supabase.from("communities").select("id, slug, name, description, kind, member_count").order("member_count", { ascending: false }),
    supabase.from("community_members").select("community_id").eq("user_id", userId),
  ]);
  const joined = new Set((mine ?? []).map((m) => m.community_id));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Communities</h1>
        <p className="text-muted">Markets from your communities rank higher in your feed.</p>
      </div>
      <ul className="space-y-3">
        {(communities ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-4 rounded-3xl bg-surface p-4 ring-1 ring-line">
            <div className="min-w-0 flex-1">
              <p className="font-black">
                {c.name} <span className="font-semibold text-muted">#{c.slug}</span>
              </p>
              <p className="text-sm text-muted">{c.description}</p>
              <p className="mt-1 text-xs font-semibold text-muted tabular">
                {c.kind === "school" ? "School" : "Topic"} · {formatCoins(c.member_count)} members
              </p>
            </div>
            <JoinButton communityId={c.id} joined={joined.has(c.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
