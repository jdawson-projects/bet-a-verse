import Link from "next/link";
import { cookies } from "next/headers";
import { Balance } from "@/components/balance";
import { Wordmark } from "@/components/logo";
import { BottomNav, HeaderNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewerProvider } from "@/components/viewer-context";
import { isStake } from "@/lib/money";
import { requireViewer } from "@/lib/viewer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, userId } = await requireViewer();
  const dark = (await cookies()).get("theme")?.value === "dark";

  return (
    <ViewerProvider
      initial={{
        userId,
        username: profile.username,
        role: profile.role,
        defaultStake: isStake(profile.default_stake) ? profile.default_stake : 5,
        balance: profile.balance,
      }}
    >
      <div className="flex min-h-dvh flex-col" style={{ paddingBottom: "calc(var(--nav-h) + env(safe-area-inset-bottom))" }}>
        <header
          className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
            <Link href="/" aria-label="Bet-a-Verse home" className="shrink-0">
              <Wordmark />
            </Link>
            <div className="flex-1" />
            <HeaderNav />
            <ThemeToggle initialDark={dark} />
            <Link href={`/u/${profile.username}`} aria-label="Your profile and coins">
              <Balance />
            </Link>
          </div>
        </header>
        {profile.banned_at && (
          <p role="alert" className="bg-no-soft px-4 py-2 text-center text-sm font-semibold text-no-strong">
            Your account is suspended. You can look around but not bet, post or create markets.
          </p>
        )}
        <main className="flex flex-1 flex-col">{children}</main>
        <BottomNav />
      </div>
    </ViewerProvider>
  );
}
