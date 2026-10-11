const HUES = [221, 262, 330, 14, 32, 152, 188, 200];

function hueFor(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

/** Initials avatar (or the profile image when there is one). */
export function Avatar({
  username,
  src,
  size = 36,
  className = "",
}: {
  username: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote avatars from OAuth providers
    return <img src={src} alt="" width={size} height={size} className={`shrink-0 rounded-full object-cover ${className}`} referrerPolicy="no-referrer" />;
  }
  const hue = hueFor(username);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-black uppercase text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42, background: `linear-gradient(140deg, hsl(${hue} 75% 55%), hsl(${hue + 30} 70% 40%))` }}
    >
      {username.slice(0, 1)}
    </span>
  );
}
