import type { NextConfig } from "next";

// `pnpm build:pages` builds the landing page alone as plain files for GitHub Pages.
// Only *.static.tsx files count as routes in that build, so none of the server-side
// app (sessions, proxy, route handlers) is compiled. See DECISIONS.md.
const pagesBuild = process.env.PAGES_BUILD === "1";

// Cache Components is off on purpose: every screen reads the session, so pages
// render per request. See DECISIONS.md.
const nextConfig: NextConfig = {
  ...(pagesBuild && {
    output: "export",
    basePath: process.env.PAGES_BASE_PATH ?? "/bet-a-verse",
    trailingSlash: true,
    pageExtensions: ["static.tsx"],
    images: { unoptimized: true },
  }),
  turbopack: {
    rules: {
      // Tailwind processes global stylesheets only. Running CSS modules through
      // it as plain CSS would drop their class-name exports.
      "*.css": {
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
