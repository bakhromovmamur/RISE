import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/infra", testMatch: "**/*.infrastructure.spec.ts", fullyParallel: false,
  forbidOnly: !!process.env.CI, workers: 1, timeout: 30000,
  outputDir: "test-results/infra/browser",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  use: { baseURL: "http://127.0.0.1:4191", viewport: { width: 393, height: 852 }, timezoneId: "Asia/Tashkent", reducedMotion: "reduce", trace: "retain-on-failure", screenshot: "only-on-failure" },
  reporter: [["list"], ["json", { outputFile: "test-results/infra/browser-report.json" }]],
  webServer: { command: "node --import tsx scripts/infra/serve-test-backend.ts", url: "http://127.0.0.1:4191/api/v1/health/ready", reuseExistingServer: false },
});
