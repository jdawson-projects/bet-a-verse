import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts", "src/**/*.test.{ts,tsx}"], environment: "node" },
      },
      {
        // Needs local Supabase (`pnpm exec supabase start`). Each test runs in a rolled-back transaction.
        extends: true,
        test: { name: "db", include: ["tests/db/**/*.test.ts"], testTimeout: 60_000 },
      },
    ],
  },
});
