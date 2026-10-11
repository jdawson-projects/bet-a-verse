"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { errorMessage } from "@/lib/errors";
import { formatCoins } from "@/lib/format";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Action = "yes" | "no" | "void";

/** Resolve (YES/NO) or void a market. Final in Phase 1, so it asks once before acting. */
export function ResolvePanel({
  marketId,
  canVoid,
  compact = false,
  onDone,
}: {
  marketId: string;
  canVoid: boolean;
  compact?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [proof, setProof] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    const supabase = getSupabaseBrowser();
    if (action === "void") {
      const { data, error } = await supabase.rpc("void_market", { p_market_id: marketId, p_note: note }).single();
      setBusy(false);
      if (error || !data) return toast.show({ message: errorMessage(error), tone: "error" });
      toast.show({ message: `Voided. ${formatCoins(data.refunded)} coins refunded.`, tone: "success" });
    } else {
      const { data, error } = await supabase
        .rpc("resolve_market", { p_market_id: marketId, p_outcome: action, p_note: note, p_proof_url: proof })
        .single();
      setBusy(false);
      if (error || !data) return toast.show({ message: errorMessage(error), tone: "error" });
      toast.show({
        message: `Resolved ${action.toUpperCase()}. Paid ${formatCoins(data.paid_out)} of ${formatCoins(data.total)} coins (house ${data.house_take}).`,
        tone: "success",
        duration: 5000,
      });
    }
    setPending(null);
    onDone?.();
    router.refresh();
  }

  const input =
    "w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-3xl bg-surface p-4 ring-1 ring-line"}>
      {!compact && <h2 className="font-black">Resolve this market</h2>}
      <label className="block text-xs font-semibold text-muted">
        Resolution note
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What happened?" className={`${input} mt-1`} />
      </label>
      <label className="block text-xs font-semibold text-muted">
        Proof URL
        <input
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          type="url"
          maxLength={500}
          placeholder="https://…"
          className={`${input} mt-1`}
        />
      </label>
      {pending ? (
        <div role="alertdialog" aria-label="Confirm resolution" className="space-y-2 rounded-2xl bg-surface-2 p-3 text-sm">
          <p>
            {pending === "void"
              ? "Void this market and refund every bet?"
              : `Resolve ${pending.toUpperCase()} and pay out winners now?`}{" "}
            This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(pending)}
              className="rounded-full bg-fg px-4 py-1.5 font-bold text-bg disabled:opacity-50"
            >
              {busy ? "Working…" : "Confirm"}
            </button>
            <button type="button" onClick={() => setPending(null)} className="rounded-full px-4 py-1.5 font-semibold ring-1 ring-line">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPending("yes")} className="rounded-full bg-yes px-4 py-1.5 text-sm font-bold text-white">
            Resolve YES
          </button>
          <button type="button" onClick={() => setPending("no")} className="rounded-full bg-no px-4 py-1.5 text-sm font-bold text-white">
            Resolve NO
          </button>
          {canVoid && (
            <button type="button" onClick={() => setPending("void")} className="rounded-full px-4 py-1.5 text-sm font-bold ring-1 ring-line">
              Void
            </button>
          )}
        </div>
      )}
    </div>
  );
}
