import type { NextConfig } from "next";

// Cache Components is off on purpose: every screen reads the session, so pages
// render per request. See DECISIONS.md.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
