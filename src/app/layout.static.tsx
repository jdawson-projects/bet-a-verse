import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// The root layout of the static GitHub Pages copy. Next only picks up files named
// *.static.tsx when it is built with PAGES_BUILD=1 (see next.config.ts), so the real
// app never sees this file. No cookies, no toast provider, no service worker.

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Bet-a-Verse", template: "%s · Bet-a-Verse" },
  description: "Swipe right for YES, left for NO. Fast, social prediction markets with play coins.",
  applicationName: "Bet-a-Verse",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5fa" },
    { media: "(prefers-color-scheme: dark)", color: "#090b12" },
  ],
};

// Same rule as the real app: light unless the visitor picked dark with the toggle.
const THEME_SCRIPT = `try{if(/(?:^|; )theme=dark/.test(document.cookie))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
