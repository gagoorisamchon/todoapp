import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The test process needs MONGODB_URI for resetDb(); Next loads .env.local itself.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
// E2E always runs against the dedicated `_e2e` database (PLAN §0, §6).
process.env.MONGODB_DB = "todo_app_e2e";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { MONGODB_DB: "todo_app_e2e" },
  },
});
