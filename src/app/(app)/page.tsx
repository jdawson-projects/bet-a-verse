import { Feed } from "@/components/feed/feed";
import { nowMs } from "@/lib/time";
import { requireViewer } from "@/lib/viewer";

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { supabase } = await requireViewer();
  const [{ welcome }, { data: cards }] = await Promise.all([searchParams, supabase.rpc("get_feed", { p_limit: 5 })]);
  return <Feed initialCards={cards ?? []} initialNow={nowMs()} welcome={welcome === "1"} />;
}
