import { cookies } from "next/headers";
import { LandingView, landingMetadata } from "@/components/landing/landing-view";
import type { LandingMarket } from "@/components/landing/campus-map";
import { getSupabaseServer } from "@/lib/supabase/server";
import { nowMs } from "@/lib/time";
import { LoginForm } from "../login/login-form";

export const metadata = landingMetadata;

export default async function LandingPage() {
  const supabase = await getSupabaseServer();
  const [{ data: markets }, { data: stats }, cookieStore] = await Promise.all([
    supabase.rpc("get_landing_markets", { p_limit: 30 }),
    supabase.rpc("get_landing_stats").single(),
    cookies(),
  ]);
  const live: LandingMarket[] = markets ?? [];
  const dark = cookieStore.get("theme")?.value === "dark";

  return (
    <LandingView
      markets={live}
      stats={stats}
      now={nowMs()}
      dark={dark}
      signIn={<LoginForm next="/" linkError={false} />}
    />
  );
}
