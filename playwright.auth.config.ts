import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/auth", testMatch: "**/*.auth.spec.ts", fullyParallel: false,
  forbidOnly: !!process.env.CI, workers: 1, timeout: 30000,
  outputDir: "test-results/auth/browser",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  // Real codes and cookies must never be retained in traces, videos or failure screenshots.
  use: { baseURL: "http://127.0.0.1:4191", viewport: { width: 393, height: 852 }, timezoneId: "Asia/Tashkent", reducedMotion: "reduce", trace: "off", screenshot: "off", video: "off" },
  reporter: [["list"], ["json", { outputFile: "test-results/auth/browser-report.json" }]],
  webServer: { command: "node --import tsx scripts/infra/serve-test-backend.ts", url: "http://127.0.0.1:4191/api/v1/health/ready", reuseExistingServer: false },
});
