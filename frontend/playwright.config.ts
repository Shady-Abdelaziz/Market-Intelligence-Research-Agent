import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-level e2e tests against a running stack.
 *
 * These tests hit the real backend (LLM + yfinance + NewsAPI) so they
 * are NOT cheap to run — limited to one browser, generous timeouts,
 * and a single retry to absorb upstream flake. Skip in CI with
 * PLAYWRIGHT_SKIP_E2E=1.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.MIRA_E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.MIRA_E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 90_000,
      },
});
