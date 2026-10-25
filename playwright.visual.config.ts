import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.visual.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 2,
  timeout: 60000,
  outputDir: "test-results/visual",
  snapshotPathTemplate: "{testDir}/baseline/{platform}/{arg}{ext}",
  updateSnapshots: "none",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css", threshold: 0, maxDiffPixels: 0 },
  },
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:4182",
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "Asia/Tashkent",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  reporter: [["list"], ["json", { outputFile: "test-results/visual-report.json" }]],
  webServer: {
    command: "node scripts/serve-test-build.mjs 4182 dist-review",
    url: "http://127.0.0.1:4182",
    reuseExistingServer: false,
  },
});
