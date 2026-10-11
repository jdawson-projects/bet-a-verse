import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { getViewer } from "@/lib/viewer";
import { UsernameForm } from "./username-form";

export const metadata: Metadata = { title: "Pick a username" };

function suggestUsername(email: string | null): string {
  const base = (email?.split("@")[0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 16);
  return base.length >= 3 ? base : "";
}

export default async function WelcomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.profile?.username) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <LogoMark className="mb-6 h-12 w-12" />
      <h1 className="text-3xl font-black tracking-tight">Pick your username</h1>
      <p className="mt-2 text-muted">It shows next to every call you make. Choose wisely, it&apos;s how people will @ you.</p>
      <UsernameForm userId={viewer.userId} suggestion={suggestUsername(viewer.email)} />
    </main>
  );
}
