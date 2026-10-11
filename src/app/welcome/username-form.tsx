"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

const USERNAME = /^[a-z0-9_]{3,20}$/;

export function UsernameForm({ userId, suggestion }: { userId: string; suggestion: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = USERNAME.test(username);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser().from("profiles").update({ username }).eq("id", userId);
    if (error) {
      setBusy(false);
      setError(error.code === "23505" ? `@${username} is taken. Try another.` : "Couldn't save that username. Try another.");
      return;
    }
    router.replace("/?welcome=1");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      <label htmlFor="username" className="text-sm font-semibold">
        Username
      </label>
      <div className="flex items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
        <span className="text-lg text-muted">@</span>
        <input
          id="username"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          className="w-full bg-transparent px-1 py-3.5 text-lg outline-none"
          aria-describedby="username-hint"
          aria-invalid={username.length > 0 && !valid}
        />
      </div>
      <p id="username-hint" className={`text-sm ${username.length > 0 && !valid ? "text-no-strong" : "text-muted"}`}>
        3–20 characters: lowercase letters, numbers and underscores.
      </p>
      <button
        type="submit"
        disabled={!valid || busy}
        className="w-full rounded-2xl bg-brand px-4 py-3.5 text-base font-bold text-white transition hover:bg-brand-strong disabled:opacity-50"
      >
        {busy ? "Saving…" : "Start swiping"}
      </button>
      {error && (
        <p role="alert" className="rounded-2xl bg-no-soft px-4 py-3 text-sm font-medium text-no-strong">
          {error}
        </p>
      )}
    </form>
  );
}
