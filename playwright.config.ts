import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.browser.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 2,
  timeout: 30000,
  outputDir: "test-results/browser",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  use: {
    baseURL: "http://127.0.0.1:4180",
    viewport: { width: 393, height: 852 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "test-results/browser-report.json" }]],
  webServer: {
    command: "node scripts/serve-test-build.mjs 4180 dist-review",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: false,
  },
});
