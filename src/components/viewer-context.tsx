"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Stake } from "@/lib/money";

export interface ViewerState {
  userId: string;
  username: string;
  role: "user" | "moderator" | "admin";
  defaultStake: Stake;
  balance: number;
  setBalance: (next: number | ((prev: number) => number)) => void;
}

const ViewerContext = createContext<ViewerState | null>(null);

export function useViewer(): ViewerState {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used inside <ViewerProvider>");
  return ctx;
}

export function ViewerProvider({
  initial,
  children,
}: {
  initial: Omit<ViewerState, "setBalance">;
  children: React.ReactNode;
}) {
  const [balance, setBalance] = useState(initial.balance);
  // Server renders after a navigation carry a fresher balance; adopt it.
  const [seen, setSeen] = useState(initial.balance);
  if (initial.balance !== seen) {
    setSeen(initial.balance);
    setBalance(initial.balance);
  }
  const value = useMemo(
    () => ({ ...initial, balance, setBalance }),
    [initial, balance],
  );
  return <ViewerContext value={value}>{children}</ViewerContext>;
}
