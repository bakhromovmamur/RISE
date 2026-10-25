import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/production",
  testMatch: "**/*.production.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 2,
  timeout: 30000,
  outputDir: "test-results/production",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  use: {
    baseURL: "http://127.0.0.1:4181",
    viewport: { width: 393, height: 852 },
    timezoneId: "Asia/Tashkent",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "test-results/production-report.json" }]],
  webServer: {
    command: "node scripts/serve-test-build.mjs 4181 dist",
    url: "http://127.0.0.1:4181",
    reuseExistingServer: false,
  },
});
