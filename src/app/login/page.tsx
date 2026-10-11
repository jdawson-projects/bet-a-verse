import type { Metadata } from "next";
import { LogoMark } from "@/components/logo";
import { safeNext } from "@/lib/redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-10 flex flex-col items-center text-center">
        <LogoMark className="mb-5 h-16 w-16 drop-shadow-lg" />
        <h1 className="text-4xl font-black tracking-tight">
          Bet<span className="text-brand">-a-</span>Verse
        </h1>
        <p className="mt-3 text-balance text-lg text-muted">
          Swipe <span className="font-semibold text-yes">right for YES</span>,{" "}
          <span className="font-semibold text-no">left for NO</span>. Call it before your friends do.
        </p>
      </div>
      <LoginForm next={safeNext(next)} linkError={error === "link"} />
      <p className="mt-10 text-center text-xs text-muted">
        Play coins only. No deposits, no withdrawals, no real money. New accounts start with 1,000 coins.
      </p>
    </main>
  );
}
