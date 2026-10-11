import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { nowMs } from "@/lib/time";
import { isStaff, requireViewer } from "@/lib/viewer";
import { AdminCommentRow, AdminMarketRow, AdminUserRow, type AdminMarket } from "./admin-rows";

export const metadata: Metadata = { title: "Admin" };

const VIEWS = [
  { id: "queue", label: "Needs resolution" },
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "voided", label: "Voided" },
  { id: "comments", label: "Comments" },
  { id: "users", label: "Users" },
] as const;
type View = (typeof VIEWS)[number]["id"];

type Props = { searchParams: Promise<{ view?: string; q?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const { supabase, profile, userId } = await requireViewer();
  if (!isStaff(profile.role)) notFound();
  const params = await searchParams;
  const view: View = VIEWS.some((v) => v.id === params.view) ? (params.view as View) : "queue";
  const q = (params.q ?? "").trim().slice(0, 80);
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Admin</h1>
          <p className="text-sm text-muted">Signed in as {profile.role}. Resolutions are final and pay out immediately.</p>
        </div>
        <form className="flex gap-2" action="/admin">
          <input type="hidden" name="view" value={view} />
          <input
            name="q"
            defaultValue={q}
            placeholder={view === "users" ? "Search usernames" : view === "comments" ? "Search comments" : "Search questions"}
            aria-label="Search"
            className="w-56 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-brand"
          />
          <button type="submit" className="rounded-full bg-fg px-4 py-2 text-sm font-bold text-bg">
            Search
          </button>
        </form>
      </div>

      <nav aria-label="Admin sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/admin?view=${v.id}`}
            aria-current={view === v.id ? "page" : undefined}
            className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold text-muted ring-1 ring-line aria-[current=page]:bg-fg aria-[current=page]:text-bg aria-[current=page]:ring-fg"
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "comments" ? (
        <CommentsView q={q} like={like} />
      ) : view === "users" ? (
        <UsersView like={like} canBan={profile.role === "admin"} selfId={userId} />
      ) : (
        <MarketsView view={view} q={q} like={like} />
      )}
    </div>
  );

  async function MarketsView({ view, q, like }: { view: View; q: string; like: string }) {
    let query = supabase
      .from("markets")
      .select("id, question, status, outcome, closes_at, resolves_by, yes_total, no_total, bet_count, featured_at, creator:profiles!markets_creator_id_fkey(username)")
      .limit(100);
    if (view === "queue") query = query.eq("status", "closed").order("resolves_by", { ascending: true });
    else if (view === "open") query = query.eq("status", "open").order("closes_at", { ascending: true });
    else query = query.eq("status", view === "voided" ? "voided" : "resolved").order("resolved_at", { ascending: false });
    if (q) query = query.ilike("question", like);
    const { data, error } = await query;
    const now = nowMs();
    const markets: AdminMarket[] = (data ?? []).map((m) => ({
      ...m,
      creator: m.creator?.username ?? null,
      overdue: (m.status === "open" || m.status === "closed") && new Date(m.resolves_by).getTime() < now,
    }));
    if (error) return <p className="text-no-strong">{error.message}</p>;
    if (markets.length === 0) {
      return (
        <p className="rounded-3xl bg-surface px-4 py-8 text-center text-muted ring-1 ring-line">
          {view === "queue" ? "Nothing waiting on a resolution." : "No markets here."}
        </p>
      );
    }
    return (
      <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
        {markets.map((m) => (
          <AdminMarketRow key={m.id} market={m} />
        ))}
      </ul>
    );
  }

  async function CommentsView({ q, like }: { q: string; like: string }) {
    let query = supabase
      .from("comments")
      .select("id, body, created_at, market_id, author:profiles!comments_user_id_fkey(username), market:markets(question)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60);
    if (q) query = query.ilike("body", like);
    const { data } = await query;
    if (!data?.length) return <p className="rounded-3xl bg-surface px-4 py-8 text-center text-muted ring-1 ring-line">No comments.</p>;
    return (
      <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
        {data.map((c) => (
          <AdminCommentRow
            key={c.id}
            comment={{
              id: c.id,
              body: c.body,
              author: c.author?.username ?? "unknown",
              marketId: c.market_id,
              question: c.market?.question ?? "",
              created_at: c.created_at,
            }}
          />
        ))}
      </ul>
    );
  }

  async function UsersView({ like, canBan, selfId }: { like: string; canBan: boolean; selfId: string }) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, role, balance, banned_at")
      .ilike("username", like)
      .order("created_at", { ascending: false })
      .limit(60);
    if (!data?.length) return <p className="rounded-3xl bg-surface px-4 py-8 text-center text-muted ring-1 ring-line">No users.</p>;
    return (
      <>
        {!canBan && <p className="text-sm text-muted">Only admins can ban users.</p>}
        <ul className="divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
          {data.map((u) => (
            <AdminUserRow key={u.id} user={u} canBan={canBan} isSelf={u.id === selfId} />
          ))}
        </ul>
      </>
    );
  }
}
