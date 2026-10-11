import { brandIcon } from "../brand-icon";

// /icons/192, /icons/512 and /icons/maskable (512 with a safe zone) for the web app manifest.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (size === "maskable") return brandIcon(512, 64);
  const n = Number(size);
  if (n !== 192 && n !== 512) return new Response("Not found", { status: 404 });
  return brandIcon(n);
}
