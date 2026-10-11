"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { CATEGORY_LABELS, formatDateTime } from "@/lib/format";
import {
  checkQuestion,
  CLOSE_PICKS,
  closeFromPick,
  DETAILS_MAX,
  MIN_CLOSE_MS,
  QUESTION_MAX,
  toLocalInput,
  type ClosePick,
} from "@/lib/market-rules";
import { shareLink } from "@/lib/share";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { nowMs } from "@/lib/time";
import { useMounted } from "@/lib/use-mounted";
import type { Category } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const DAY = 24 * 3_600_000;

export function CreateForm({ communities }: { communities: { id: string; slug: string; name: string }[] }) {
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<Category>("campus");
  const [communityId, setCommunityId] = useState("");
  const [pick, setPick] = useState<ClosePick>("24h");
  const [custom, setCustom] = useState("");
  const [resolvesBy, setResolvesBy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; question: string } | null>(null);
  const [now, setNow] = useState(nowMs);
  const mounted = useMounted();

  const q = checkQuestion(question);
  const closes = pick === "custom" ? (custom ? new Date(custom) : null) : closeFromPick(pick, new Date(now));
  const closeError =
    closes && closes.getTime() < now + MIN_CLOSE_MS ? "Markets have to close at least 10 minutes from now" : null;
  const resolves = resolvesBy ? new Date(resolvesBy) : closes ? new Date(closes.getTime() + DAY) : null;
  const resolveError = resolves && closes && resolves < closes ? "Resolve-by can't be before betting closes" : null;
  const canSubmit = q.ok && closes && !closeError && resolves && !resolveError && details.length <= DETAILS_MAX && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNow(nowMs());
    if (!canSubmit || !closes || !resolves) return;
    setBusy(true);
    const { data, error } = await getSupabaseBrowser()
      .from("markets")
      .insert({
        question: question.trim(),
        details: details.trim(),
        category,
        community_id: communityId || null,
        closes_at: closes.toISOString(),
        resolves_by: resolves.toISOString(),
      })
      .select("id, question")
      .single();
    setBusy(false);
    if (error || !data) {
      toast.show({ message: errorMessage(error), tone: "error" });
      return;
    }
    setCreated(data);
  }

  if (created) {
    const url = `${window.location.origin}/m/${created.id}`;
    return (
      <div className="mt-8 space-y-5 rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-yes text-white">
          <CheckIcon className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tight">Your market is live</h2>
          <p className="mt-1 text-muted">&ldquo;{created.question}&rdquo;</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-bg p-2 ring-1 ring-line">
          <input readOnly value={url} aria-label="Share link" className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" onFocus={(e) => e.target.select()} />
          <button
            type="button"
            onClick={async () => {
              const r = await shareLink(url, created.question);
              if (r === "copied") toast.show({ message: "Link copied" });
            }}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white"
          >
            Share
          </button>
        </div>
        <div className="flex justify-center gap-3">
          <Link href={`/m/${created.id}`} className="whitespace-nowrap rounded-full bg-fg px-5 py-2.5 font-bold text-bg">
            View market
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setQuestion("");
              setDetails("");
              setResolvesBy(null);
            }}
            className="whitespace-nowrap rounded-full px-5 py-2.5 font-bold ring-1 ring-line"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  const field = "w-full rounded-2xl border border-line bg-surface px-4 py-3 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15";
  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm font-bold ring-1 transition ${active ? "bg-brand text-white ring-brand" : "bg-surface ring-line hover:bg-surface-2"}`;

  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      <div className="space-y-1.5">
        <label htmlFor="question" className="text-sm font-bold">
          Question
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value.replace(/\n/g, " "))}
          rows={2}
          maxLength={QUESTION_MAX + 20}
          placeholder="Will the Reg hit capacity before 8pm on Tuesday?"
          aria-invalid={Boolean(q.error)}
          aria-describedby="question-help"
          className={`${field} resize-none text-lg font-semibold`}
        />
        <div id="question-help" className="flex justify-between gap-3 text-xs">
          <span className={q.error ? "font-semibold text-no-strong" : "text-muted"}>{q.error ?? q.hint ?? "End it with a question mark."}</span>
          <span className={`tabular ${question.trim().length > QUESTION_MAX ? "font-bold text-no-strong" : "text-muted"}`}>
            {question.trim().length}/{QUESTION_MAX}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="details" className="text-sm font-bold">
          How it resolves
        </label>
        <textarea
          id="details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={DETAILS_MAX}
          placeholder="Source of truth and edge cases. e.g. Per the Reg occupancy counter at 8:00 pm."
          className={`${field} resize-y text-[15px]`}
        />
        <p className="text-right text-xs text-muted tabular">
          {details.length}/{DETAILS_MAX}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Category</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </fieldset>

      {communities.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="community" className="text-sm font-bold">
            Community <span className="font-normal text-muted">(optional)</span>
          </label>
          <select id="community" value={communityId} onChange={(e) => setCommunityId(e.target.value)} className={field}>
            <option value="">Everyone</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (#{c.slug})
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Betting closes</legend>
        <div className="flex flex-wrap gap-2">
          {CLOSE_PICKS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={pick === p.id}
              onClick={() => {
                setNow(nowMs());
                setPick(p.id);
                setResolvesBy(null);
                if (p.id === "custom" && !custom) setCustom(toLocalInput(new Date(nowMs() + 2 * 3_600_000)));
              }}
              className={chip(pick === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {pick === "custom" && (
          <input
            type="datetime-local"
            aria-label="Custom close time"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setResolvesBy(null);
            }}
            className={field}
          />
        )}
        <p className={`text-sm ${closeError ? "font-semibold text-no-strong" : "text-muted"}`}>
          {!mounted ? "\u00a0" : (closeError ?? (closes ? `Closes ${formatDateTime(closes.toISOString())}` : "Pick a time"))}
        </p>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="resolves" className="text-sm font-bold">
          Resolves by
        </label>
        <input
          id="resolves"
          type="datetime-local"
          value={mounted && resolves ? toLocalInput(resolves) : ""}
          onChange={(e) => setResolvesBy(e.target.value || null)}
          className={field}
          aria-invalid={Boolean(resolveError)}
        />
        <p className={`text-xs ${resolveError ? "font-semibold text-no-strong" : "text-muted"}`}>
          {resolveError ?? "Defaults to 24 hours after close. You can resolve it yourself if you don't bet on it."}
        </p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-2xl bg-brand px-4 py-4 text-lg font-black text-white shadow-sm transition hover:bg-brand-strong disabled:opacity-40"
      >
        {busy ? "Publishing…" : "Publish market"}
      </button>
    </form>
  );
}
