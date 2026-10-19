import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:4173";
// Set E2E_REUSE_SERVER to run against servers you started yourself, to read their logs.
const reuseExistingServer = Boolean(process.env.E2E_REUSE_SERVER);

// The gateway stubs read the test credentials that the Worker gets from .dev.vars.example.
process.loadEnvFile(".dev.vars.example");
const stub = (name: "razorpay" | "mips", port: number) => ({
  command: `node stubs/${name}.ts`,
  env: { SITE_URL: baseURL },
  reuseExistingServer,
  url: `http://localhost:${port}/__stub/health`,
});

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
  // `playwright.dev.config.ts` runs these against `vite dev`.
  testIgnore: "**/tests/dev/**",
  timeout: 60_000,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm preview --port 4173 --strictPort",
      reuseExistingServer,
      timeout: 120_000,
      url: baseURL,
    },
    stub("razorpay", 4890),
    stub("mips", 4891),
  ],
  workers: 3,
});
