"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-black tracking-tight">Something broke</h1>
      <p className="text-muted">Your coins are safe: every bet goes through the ledger or not at all.</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-brand px-5 py-2.5 font-bold text-white">
          Try again
        </button>
        <Link href="/" className="rounded-full px-5 py-2.5 font-bold ring-1 ring-line">
          Feed
        </Link>
      </div>
    </div>
  );
}
