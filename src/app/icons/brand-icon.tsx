import { ImageResponse } from "next/og";

/** The app icon, drawn with next/og so every size is crisp. `padding` > 0 leaves a maskable safe zone. */
export function brandIcon(size: number, padding = 0) {
  const inner = size - padding * 2;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#3554f5" }}>
        <svg width={inner} height={inner} viewBox="0 0 64 64">
          <rect width="64" height="64" rx={padding ? 0 : 14} fill="#3554f5" />
          <rect x="14" y="13" width="30" height="40" rx="7" fill="#ffffff" opacity="0.35" transform="rotate(-10 29 33)" />
          <rect x="20" y="11" width="30" height="40" rx="7" fill="#ffffff" transform="rotate(8 35 31)" />
          <path
            d="M29 31.5l4.5 4.5 8-9"
            stroke="#0f9d58"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="rotate(8 35 31)"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
