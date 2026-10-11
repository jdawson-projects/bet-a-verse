"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { HeartIcon } from "@/components/icons";
import { SideBadge } from "@/components/side-badge";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { errorMessage } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface CommentView {
  id: string;
  parent_id: string | null;
  body: string;
  like_count: number;
  deleted_at: string | null;
  created_at: string;
  user_id: string;
  username: string;
  side: "yes" | "no" | null;
  liked: boolean;
}

const MAX = 500;

export function Comments({
  marketId,
  initial,
  mySide,
  canModerate,
}: {
  marketId: string;
  initial: CommentView[];
  mySide: "yes" | "no" | null;
  canModerate: boolean;
}) {
  const toast = useToast();
  const { userId, username } = useViewer();
  const [comments, setComments] = useState(initial);
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);

  const threads = useMemo(() => {
    const top = comments.filter((c) => !c.parent_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const replies = new Map<string, CommentView[]>();
    for (const c of comments) {
      if (c.parent_id) replies.set(c.parent_id, [...(replies.get(c.parent_id) ?? []), c]);
    }
    for (const list of replies.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return top.map((c) => ({ comment: c, replies: replies.get(c.id) ?? [] }));
  }, [comments]);

  async function post(body: string, parent: CommentView | null): Promise<boolean> {
    const { data, error } = await getSupabaseBrowser()
      .from("comments")
      .insert({ market_id: marketId, body, parent_id: parent?.parent_id ?? parent?.id ?? null })
      .select("id, parent_id, body, like_count, deleted_at, created_at, user_id")
      .single();
    if (error || !data) {
      toast.show({ message: errorMessage(error), tone: "error" });
      return false;
    }
    setComments((cs) => [...cs, { ...data, username, side: mySide, liked: false }]);
    setReplyTo(null);
    return true;
  }

  async function remove(c: CommentView) {
    const { error } = await getSupabaseBrowser().rpc("delete_comment", { p_comment_id: c.id });
    if (error) {
      toast.show({ message: errorMessage(error), tone: "error" });
      return;
    }
    setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, deleted_at: new Date().toISOString() } : x)));
  }

  async function toggleLike(c: CommentView) {
    const liked = !c.liked;
    const patch = (delta: number, value: boolean) =>
      setComments((cs) =>
        cs.map((x) => (x.id === c.id ? { ...x, liked: value, like_count: Math.max(0, x.like_count + delta) } : x)),
      );
    patch(liked ? 1 : -1, liked);
    const supabase = getSupabaseBrowser();
    const { error } = liked
      ? await supabase.from("comment_likes").insert({ comment_id: c.id })
      : await supabase.from("comment_likes").delete().eq("comment_id", c.id).eq("user_id", userId);
    if (error && error.code !== "23505") {
      patch(liked ? -1 : 1, !liked);
      toast.show({ message: errorMessage(error), tone: "error" });
    }
  }

  const row = (c: CommentView, isReply: boolean) => (
    <li key={c.id} className={`flex gap-3 ${isReply ? "pl-11" : ""}`}>
      <Link href={`/u/${c.username}`} className="shrink-0" aria-label={`@${c.username}`}>
        <Avatar username={c.username} size={isReply ? 28 : 34} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <Link href={`/u/${c.username}`} className="font-bold hover:underline">
            @{c.username}
          </Link>
          {c.side && <SideBadge side={c.side} />}
          <span className="text-xs text-muted">{timeAgo(c.created_at)}</span>
        </div>
        {c.deleted_at ? (
          <p className="mt-0.5 text-sm italic text-muted">Comment deleted</p>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug">{c.body}</p>
        )}
        {!c.deleted_at && (
          <div className="mt-1.5 flex items-center gap-4 text-xs font-semibold text-muted">
            <button
              type="button"
              onClick={() => toggleLike(c)}
              aria-pressed={c.liked}
              className={`flex items-center gap-1 hover:text-fg ${c.liked ? "text-no-strong" : ""}`}
            >
              <HeartIcon className="h-3.5 w-3.5" filled={c.liked} />
              <span className="tabular">{c.like_count}</span>
              <span className="sr-only">{c.liked ? "Unlike comment" : "Like comment"}</span>
            </button>
            <button type="button" onClick={() => setReplyTo(c)} className="hover:text-fg">
              Reply
            </button>
            {(c.user_id === userId || canModerate) && (
              <button type="button" onClick={() => remove(c)} className="hover:text-no-strong">
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );

  return (
    <section id="comments" aria-label="Comments" className="scroll-mt-20 space-y-5">
      <h2 className="text-lg font-black tracking-tight">
        Trash talk <span className="text-muted tabular">{comments.filter((c) => !c.deleted_at).length}</span>
      </h2>
      <Composer key={replyTo?.id ?? "root"} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} onPost={post} />
      {threads.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-muted ring-1 ring-line">
          No comments yet. Say something bold.
        </p>
      ) : (
        <ul className="space-y-5">
          {threads.map(({ comment, replies }) => (
            <li key={comment.id}>
              <ul className="space-y-3">
                {row(comment, false)}
                {replies.map((r) => row(r, true))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Composer({
  replyTo,
  onCancelReply,
  onPost,
}: {
  replyTo: CommentView | null;
  onCancelReply: () => void;
  onPost: (body: string, parent: CommentView | null) => Promise<boolean>;
}) {
  const [body, setBody] = useState(replyTo ? `@${replyTo.username} ` : "");
  const [busy, setBusy] = useState(false);
  const trimmed = body.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || trimmed.length > MAX) return;
    setBusy(true);
    const ok = await onPost(trimmed, replyTo);
    setBusy(false);
    if (ok) setBody("");
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-surface p-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
      {replyTo && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-1.5 text-xs">
          <span>
            Replying to <strong>@{replyTo.username}</strong>
          </span>
          <button type="button" onClick={onCancelReply} className="font-semibold text-muted hover:text-fg">
            Cancel
          </button>
        </div>
      )}
      <label htmlFor="comment-body" className="sr-only">
        Comment
      </label>
      <textarea
        id="comment-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus={replyTo !== null}
        rows={2}
        maxLength={MAX + 50}
        placeholder="Talk your talk…"
        className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs tabular ${trimmed.length > MAX ? "font-bold text-no-strong" : "text-muted"}`}>
          {trimmed.length}/{MAX}
        </span>
        <button
          type="submit"
          disabled={busy || !trimmed || trimmed.length > MAX}
          className="rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? "Posting…" : replyTo ? "Reply" : "Post"}
        </button>
      </div>
    </form>
  );
}
