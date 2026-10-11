"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckIcon, XIcon } from "@/components/icons";
import { StakePill } from "@/components/stake-pill";
import { useToast } from "@/components/toast";
import { useViewer } from "@/components/viewer-context";
import { errorMessage } from "@/lib/errors";
import { formatCoins } from "@/lib/format";
import { estimatePayout, MAX_EXPOSURE_PER_MARKET, type Side, type Stake } from "@/lib/money";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { nowMs, undoToastMs } from "@/lib/time";

export function BetPanel({
  marketId,
  yesTotal,
  noTotal,
  rakeBps,
  maxStake,
  exposure,
}: {
  marketId: string;
  yesTotal: number;
  noTotal: number;
  rakeBps: number;
  maxStake: number;
  exposure: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const { balance, setBalance, defaultStake } = useViewer();
  const [stake, setStake] = useState<Stake>(defaultStake <= maxStake ? defaultStake : 1);
  const [busy, setBusy] = useState<Side | null>(null);
  const room = MAX_EXPOSURE_PER_MARKET - exposure;

  async function bet(side: Side) {
    setBusy(side);
    const startedAt = nowMs();
    setBalance((b) => b - stake);
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase
      .rpc("place_bet", { p_market_id: marketId, p_side: side, p_stake: stake })
      .single();
    setBusy(null);
    if (error || !data) {
      setBalance((b) => b + stake);
      toast.show({ message: errorMessage(error), tone: "error" });
      return;
    }
    navigator.vibrate?.(12);
    setBalance(data.balance);
    router.refresh();
    const remaining = undoToastMs(startedAt);
    if (remaining) {
      toast.show({
        id: "undo",
        message: `Bet placed · ${stake} on ${side.toUpperCase()}`,
        duration: remaining,
        action: {
          label: "Undo",
          onClick: async () => {
            const { data: undone, error: undoError } = await supabase.rpc("cancel_bet", { p_bet_id: data.bet_id }).single();
            if (undoError || !undone) {
              toast.show({ message: errorMessage(undoError), tone: "error" });
              return;
            }
            setBalance(undone.balance);
            toast.show({ message: `Undone. ${stake} coin${stake === 1 ? "" : "s"} back.` });
            router.refresh();
          },
        },
      });
    }
  }

  const est = (side: Side) => estimatePayout({ yesTotal, noTotal, side, stake, rakeBps });
  const disabled = busy !== null || stake > room || stake > balance;

  return (
    <section aria-label="Place a bet" className="space-y-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StakePill value={stake} onChange={setStake} max={Math.min(maxStake, room)} balance={balance} />
        <span className="text-xs text-muted tabular">
          {room > 0 ? `You can stake ${room} more here` : "You've hit the 100-coin limit here"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["no", "yes"] as const).map((side) => {
          const e = est(side);
          return (
            <button
              key={side}
              type="button"
              onClick={() => bet(side)}
              disabled={disabled}
              className={`flex flex-col items-center rounded-2xl px-3 py-3 text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50 ${
                side === "yes" ? "bg-yes hover:bg-yes-strong" : "bg-no hover:bg-no-strong"
              }`}
            >
              <span className="flex items-center gap-1.5 text-lg font-black">
                {side === "yes" ? <CheckIcon /> : <XIcon />}
                {busy === side ? "Placing…" : `${side.toUpperCase()} · ${stake}`}
              </span>
              <span className="text-xs font-semibold text-white/85">
                {e === null ? `no one on ${side === "yes" ? "NO" : "YES"} yet` : `~${formatCoins(e)} if right`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
