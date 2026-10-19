import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { CheckIcon, CommentIcon, XIcon } from "@/components/icons";
import { CampusMap, type LandingMarket } from "@/components/landing/campus-map";
import { WordCycler } from "@/components/landing/word-cycler";
import { LogoMark, Wordmark } from "@/components/logo";
import { PricePills, SplitBar } from "@/components/market/price";
import { ThemeToggle } from "@/components/theme-toggle";
import { CATEGORY_LABELS, closesIn, formatCoins } from "@/lib/format";

// The landing page body, shared by two pages: the real one (live bets from
// Supabase, sign-in form) and the static GitHub Pages copy (frozen sample bets,
// links to the code). Nothing in here may import Supabase or read the session.

const bubbleFont = Fredoka({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-bubble" });

export const landingMetadata: Metadata = {
  title: "Bet-a-Verse · Call it before your friends do",
  description:
    "Swipe right for YES, left for NO. Fast, social prediction markets for UChicago with play coins: tonight's game, the Reg line, the Econ midterm, the weather.",
  openGraph: {
    title: "Bet-a-Verse",
    description: "Swipe right for YES, left for NO. Campus prediction markets with play coins.",
    type: "website",
  },
};

const CYCLE = [
  "tonight's game",
  "the Econ midterm average",
  "the Reg hitting capacity",
  "Saturday's weather",
  "the 55 bus being late",
  "Scav leaking early",
  "Bitcoin by Friday",
  "trivia night at the Pub",
];

export interface LandingStats {
  open_markets: number;
  bets_today: number;
  players: number;
}

export interface LandingViewProps {
  markets: readonly LandingMarket[];
  stats: LandingStats | null;
  now: number;
  /** Theme the server rendered, so the toggle starts in the right state. */
  dark: boolean;
  /** Set on the static GitHub Pages copy: no sign-in, no live data, links go to the code. */
  preview?: { repoUrl: string };
  /** The sign-in form, for the real app. */
  signIn?: ReactNode;
}

export function LandingView({ markets, stats, now, dark, preview, signIn }: LandingViewProps) {
  const live = markets;
  return (
    <div className={`${bubbleFont.variable} min-h-dvh`}>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/" aria-label="Bet-a-Verse">
            <Wordmark />
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm font-semibold">
            <a href="#how" className="hidden rounded-full px-3 py-1.5 text-muted hover:text-fg sm:block">
              How it works
            </a>
            <a href="#live" className="hidden rounded-full px-3 py-1.5 text-muted hover:text-fg sm:block">
              {preview ? "Sample bets" : "Live now"}
            </a>
            <ThemeToggle initialDark={dark} />
            {preview ? (
              <a href={preview.repoUrl} className="ml-1 rounded-full bg-fg px-4 py-2 text-sm font-bold text-bg">
                GitHub
              </a>
            ) : (
              <Link href="/login" className="ml-1 rounded-full bg-fg px-4 py-2 text-sm font-bold text-bg">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:pt-14">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            &gt;&gt; prediction markets · play coins · hyde park
          </p>
          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
            Call it before your friends do.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-lg text-muted sm:text-xl">
            Swipe <span className="font-bold text-yes">right for YES</span>, <span className="font-bold text-no">left for NO</span>,
            a few coins at a time. Every bet is public, every market has a thread, and the crowd shows its hand the moment you
            swipe.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {preview ? (
              <a href={preview.repoUrl} className="rounded-full bg-brand px-6 py-3.5 text-base font-black text-white shadow-sm transition hover:bg-brand-strong">
                See the code
              </a>
            ) : (
              <Link href="/login" className="rounded-full bg-brand px-6 py-3.5 text-base font-black text-white shadow-sm transition hover:bg-brand-strong">
                Start swiping
              </Link>
            )}
            <a href="#how" className="group font-mono text-sm font-semibold text-brand">
              &gt;&gt; how it works <span className="animate-pulse">_</span>
            </a>
          </div>
        </section>

        {/* The campus */}
        <section className="mx-auto w-full max-w-6xl px-2 pt-6 sm:px-4" aria-labelledby="campus-title">
          <h2 id="campus-title" className="sr-only">
            {preview ? "Sample bets around campus" : "Live bets around campus"}
          </h2>
          <CampusMap markets={live} hrefFor={preview ? () => "#live" : undefined} />
          <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {preview
              ? "Hyde Park, not to scale · bubbles are sample bets · this page is a preview"
              : "Hyde Park, not to scale · bubbles are live markets · tap one to call it"}
          </p>
        </section>

        {/* Word cycler */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:py-20">
          <p className="font-mono text-base text-muted sm:text-xl">
            The market for{" "}
            <WordCycler words={CYCLE} className="font-bold text-fg" />
          </p>
          {stats && !preview && (
            <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {formatCoins(stats.open_markets)} open markets · {formatCoins(stats.bets_today)} calls in the last 24h ·{" "}
              {formatCoins(stats.players)} players
            </p>
          )}
        </section>

        {/* Live markets */}
        <section id="live" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">&gt;&gt; {preview ? "sample bets" : "live now"}</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">What campus is calling</h2>
            </div>
            {!preview && (
              <Link href="/login" className="hidden whitespace-nowrap font-mono text-sm font-semibold text-brand sm:block">
                &gt;&gt; see all _
              </Link>
            )}
          </div>
          {live.length === 0 ? (
            <p className="mt-6 rounded-3xl bg-surface px-4 py-10 text-center text-muted ring-1 ring-line">
              No open markets yet. Sign in and start the first one.
            </p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {live.slice(0, 6).map((m) => {
                const cardClass =
                  "flex h-full flex-col gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg";
                const body = (
                  <>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-brand">{CATEGORY_LABELS[m.category]}</span>
                      {m.community_slug && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">#{m.community_slug}</span>}
                      <span className="ml-auto font-mono normal-case tracking-normal text-muted">closes in {closesIn(m.closes_at, now)}</span>
                    </div>
                    <p className="text-balance text-lg font-black leading-tight tracking-tight">{m.question}</p>
                    <div className="mt-auto space-y-2">
                      <PricePills yes={m.yes_total} no={m.no_total} size="sm" />
                      <SplitBar yes={m.yes_total} no={m.no_total} className="bg-surface-2" />
                      <p className="text-xs font-semibold text-muted tabular">
                        {formatCoins(m.yes_total + m.no_total)} coins in the pot · {m.bet_count} bet{m.bet_count === 1 ? "" : "s"}
                        {m.bets_last_minute > 0 && <span className="text-coin"> · 🔥 {m.bets_last_minute} in the last minute</span>}
                      </p>
                    </div>
                  </>
                );
                return (
                  <li key={m.id}>
                    {preview ? (
                      <div className={cardClass}>{body}</div>
                    ) : (
                      <Link href={`/login?next=${encodeURIComponent(`/m/${m.id}`)}`} className={cardClass}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">&gt;&gt; how it works</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">Ten bets a minute. Zero dollars.</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Swipe",
                body: "A stack of yes/no questions. Right is YES, left is NO, up skips. Stake 1, 5, 10 or 25 coins. No confirm screens, undo for five seconds.",
                icon: (
                  <span className="flex gap-1">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-no text-white"><XIcon className="h-4 w-4" /></span>
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-yes text-white"><CheckIcon className="h-4 w-4" /></span>
                  </span>
                ),
              },
              {
                n: "02",
                title: "See the crowd",
                body: "The second you swipe, you see what everyone else said and what you'd win. Then it's trash talk in the thread, with everyone's side on their name.",
                icon: <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white"><CommentIcon className="h-4 w-4" /></span>,
              },
              {
                n: "03",
                title: "Called it",
                body: "Markets settle like a parimutuel pool: the winners split the pot. Your record, win rate and streak live on your profile, and every win gets a card to share.",
                icon: <span className="grid h-8 w-8 place-items-center rounded-full bg-coin text-white text-sm font-black">¢</span>,
              },
            ].map((step) => (
              <li key={step.n} className="rounded-3xl bg-surface p-6 ring-1 ring-line">
                <div className="flex items-center justify-between">
                  {step.icon}
                  <span className="font-mono text-sm text-muted">{step.n}</span>
                </div>
                <h3 className="mt-4 text-xl font-black">{step.title}</h3>
                <p className="mt-2 text-pretty text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Sign in, or the way to the code */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20">
          <div className="grid gap-8 rounded-[32px] bg-surface p-6 ring-1 ring-line sm:grid-cols-2 sm:p-10">
            <div>
              <LogoMark className="h-12 w-12" />
              {preview ? (
                <>
                  <h2 className="mt-4 text-3xl font-black tracking-tight">Built, tested and open source.</h2>
                  <p className="mt-2 text-muted">
                    This page is the front door. The full app, with the swipe feed, the play-coin ledger and parimutuel settlement,
                    runs from the code on GitHub. Play coins only: nothing to deposit, nothing to withdraw.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-3xl font-black tracking-tight">1,000 coins on the house.</h2>
                  <p className="mt-2 text-muted">
                    Sign in with your email and you&apos;re swiping in thirty seconds. Play coins only: nothing to deposit, nothing to
                    withdraw, nothing to lose but bragging rights.
                  </p>
                </>
              )}
            </div>
            {preview ? (
              <div className="flex items-center">
                <a
                  href={preview.repoUrl}
                  className="inline-flex w-full items-center justify-center rounded-full bg-brand px-6 py-4 text-base font-black text-white shadow-sm transition hover:bg-brand-strong sm:w-auto"
                >
                  View the code on GitHub
                </a>
              </div>
            ) : (
              <div>{signIn}</div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 font-mono text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Bet-a-Verse · built in Hyde Park</span>
          <span>Play money only. No deposits, no withdrawals, no real money.</span>
        </div>
      </footer>
    </div>
  );
}
