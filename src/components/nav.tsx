"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, PlusIcon, ShieldIcon, UserIcon } from "./icons";
import { useViewer } from "./viewer-context";

function useItems() {
  const { username, role } = useViewer();
  const items = [
    { href: "/", label: "Feed", Icon: HomeIcon, match: (p: string) => p === "/" },
    { href: "/create", label: "Create", Icon: PlusIcon, match: (p: string) => p.startsWith("/create") },
    { href: `/u/${username}`, label: "Profile", Icon: UserIcon, match: (p: string) => p === `/u/${username}` },
  ];
  if (role !== "user") {
    items.push({ href: "/admin", label: "Admin", Icon: ShieldIcon, match: (p: string) => p.startsWith("/admin") });
  }
  return items;
}

/** Inline nav in the header on md+ screens. */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {useItems().map(({ href, label, match }) => (
        <Link
          key={href}
          href={href}
          aria-current={match(pathname) ? "page" : undefined}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Bottom tab bar on phones. */
export function BottomNav() {
  const pathname = usePathname();
  const items = useItems();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch">
        {items.map(({ href, label, Icon, match }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={match(pathname) ? "page" : undefined}
              className="flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted transition aria-[current=page]:text-brand"
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
