import { redirect } from "next/navigation";
import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase/server";

const PROFILE_COLUMNS = "id, username, display_name, avatar_url, balance, default_stake, role, banned_at" as const;

/** The signed-in user and their profile, once per request. Null when signed out. */
export const getViewer = cache(async () => {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  return { supabase, userId, email: (data.claims.email as string | undefined) ?? null, profile };
});

/** For app pages: signed in and onboarded, or redirect. */
export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.profile?.username) redirect("/welcome");
  return { ...viewer, profile: { ...viewer.profile, username: viewer.profile.username } };
}

export function isStaff(role: string | null | undefined): boolean {
  return role === "moderator" || role === "admin";
}
