import type { NextConfig } from "next";

// Cache Components is off on purpose: every screen reads the session, so pages
// render per request. See DECISIONS.md.
const nextConfig: NextConfig = {
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
