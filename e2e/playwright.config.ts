import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:4173";

export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  outputDir: "test-results",
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      dependencies: ["setup"],
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "tests/.auth/admin.json" },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
  testDir: "tests",
  timeout: 60_000,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: {
    command: "pnpm preview --port 4173 --strictPort",
    // Set E2E_REUSE_SERVER to run against a `pnpm preview` you started yourself, to read its logs.
    reuseExistingServer: Boolean(process.env.E2E_REUSE_SERVER),
    timeout: 120_000,
    url: baseURL,
  },
  workers: 3,
});
