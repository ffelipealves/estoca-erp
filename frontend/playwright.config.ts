import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  projects: [
    {
      name: "Mobile Safari (WebKit)",
      use: { ...devices["iPhone 13"] },
    },
  ],
  reporter: "list",
  testDir: "./tests/e2e",
  timeout: 240_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://estoca-erp.vercel.app",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
