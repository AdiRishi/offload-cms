import { defineConfig } from "@playwright/test";

const baseURL = "http://localhost:5173";

// Runs after the main suite, whose setup project created the admin. `vite dev` and
// `vite preview` must not run together: two local processes on one D1 database fail.
export default defineConfig({
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  outputDir: "test-results/dev",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/dev" }]],
  testDir: "tests/dev",
  // The first requests compile the admin, and each config edit reloads Payload.
  timeout: 300_000,
  use: { baseURL, storageState: "tests/.auth/admin.json", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm dev --port 5173 --strictPort",
    timeout: 120_000,
    url: `${baseURL}/api/users/init`,
  },
  workers: 1,
});
