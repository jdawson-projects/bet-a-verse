import type { Metadata } from "next";
import { requireViewer } from "@/lib/viewer";
import { CreateForm } from "./create-form";

export const metadata: Metadata = { title: "Create a market" };

export default async function CreatePage() {
  const { supabase, userId } = await requireViewer();
  const { data } = await supabase
    .from("community_members")
    .select("community:communities(id, slug, name)")
    .eq("user_id", userId);
  const communities = (data ?? []).flatMap((r) => (r.community ? [r.community] : []));
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="text-3xl font-black tracking-tight">New market</h1>
      <p className="mt-1 text-muted">Ask a yes/no question your friends will fight about.</p>
      <CreateForm communities={communities} />
    </div>
  );
}
