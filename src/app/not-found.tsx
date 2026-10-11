import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark className="h-12 w-12" />
      <h1 className="text-3xl font-black tracking-tight">Nothing to bet on here</h1>
      <p className="text-muted">That page or market doesn&apos;t exist, or it was removed.</p>
      <Link href="/" className="rounded-full bg-brand px-5 py-3 font-bold text-white">
        Back to the feed
      </Link>
    </main>
  );
}
