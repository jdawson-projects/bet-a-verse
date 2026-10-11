"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/errors";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError ? "That sign-in link didn't work here. Enter the 6-digit code from the email instead." : null,
  );

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback() },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setBusy(false);
      setError(error.message.includes("expired") ? "That code expired or is wrong. Send a new one." : errorMessage(error));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function google() {
    setError(null);
    const { error } = await getSupabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback() },
    });
    if (error) setError(error.message.includes("not enabled") ? "Google sign-in isn't set up here yet. Use email." : error.message);
  }

  const input =
    "w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15";
  const primary =
    "w-full rounded-2xl bg-brand px-4 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-brand-strong disabled:opacity-60";

  return (
    <div className="space-y-4">
      {step === "email" ? (
        <form onSubmit={sendLink} className="space-y-3">
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@uchicago.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
          <button type="submit" disabled={busy} className={primary}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm">
            We sent a link and a 6-digit code to <strong>{email}</strong>. Tap the link, or enter the code here.
          </p>
          <label htmlFor="code" className="sr-only">
            6-digit code
          </label>
          <input
            id="code"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${input} text-center font-mono text-2xl tracking-[0.5em]`}
          />
          <button type="submit" disabled={busy || code.length !== 6} className={primary}>
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm text-muted">
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => setStep("email")}>
              Use a different email
            </button>
            <button type="button" className="underline-offset-2 hover:underline" onClick={() => sendLink()} disabled={busy}>
              Resend
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <button
        type="button"
        onClick={google}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-base font-semibold transition hover:bg-surface-2"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
        </svg>
        Continue with Google
      </button>
      {error && (
        <p role="alert" className="rounded-2xl bg-no-soft px-4 py-3 text-sm font-medium text-no-strong">
          {error}
        </p>
      )}
    </div>
  );
}
