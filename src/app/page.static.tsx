import type { LandingMarket } from "@/components/landing/campus-map";
import { LandingView, landingMetadata } from "@/components/landing/landing-view";
import snapshot from "@/components/landing/snapshot.json";
import { nowMs } from "@/lib/time";

export const metadata = landingMetadata;

const REPO_URL = "https://github.com/jdawson-projects/bet-a-verse";

/**
 * The landing page for GitHub Pages: the same view as the real app, fed a frozen board
 * of sample bets (`pnpm snapshot`) instead of Supabase. Closing times are offsets from
 * the build, and "bets in the last minute" is zeroed so nothing claims to be live.
 */
export default function PreviewPage() {
  const now = nowMs();
  const markets: LandingMarket[] = snapshot.markets.map((m) => ({
    id: m.id,
    question: m.question,
    category: m.category as LandingMarket["category"],
    community_slug: m.community_slug ?? "",
    closes_at: new Date(now + m.closes_in_s * 1000).toISOString(),
    yes_total: m.yes_total,
    no_total: m.no_total,
    bet_count: m.bet_count,
    bets_last_minute: 0,
    featured: m.featured,
  }));
  return <LandingView markets={markets} stats={snapshot.stats} now={now} dark={false} preview={{ repoUrl: REPO_URL }} />;
}
