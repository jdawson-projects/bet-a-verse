import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3000);

// Needs local Supabase running and seeded: `pnpm db:start && pnpm db:reset`.
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: process.env.CI ? `pnpm build && pnpm start -p ${PORT}` : `pnpm dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
