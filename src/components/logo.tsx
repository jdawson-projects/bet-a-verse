export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <rect x="14" y="13" width="30" height="40" rx="7" fill="#fff" opacity="0.35" transform="rotate(-10 29 33)" />
      <rect x="20" y="11" width="30" height="40" rx="7" fill="#fff" transform="rotate(8 35 31)" />
      <path d="M29 31.5l4.5 4.5 8-9" stroke="var(--yes)" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" transform="rotate(8 35 31)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-lg font-black tracking-tight">
      <LogoMark className="h-7 w-7" />
      <span>
        Bet<span className="text-brand">-a-</span>Verse
      </span>
    </span>
  );
}
