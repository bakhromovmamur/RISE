import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/pwa", testMatch: "**/*.pwa.spec.ts", fullyParallel: false, workers: 1,
  forbidOnly: !!process.env.CI, timeout: 60000, outputDir: "test-results/pwa",
  projects: ["chromium", "webkit", "firefox"].map(browserName => ({ name: browserName, use: { browserName: browserName as "chromium" | "webkit" | "firefox" } })),
  use: { baseURL: "http://127.0.0.1:4181", viewport: { width: 393, height: 852 }, timezoneId: "Asia/Tashkent", reducedMotion: "reduce", trace: "retain-on-failure", screenshot: "only-on-failure" },
  reporter: [["list"], ["json", { outputFile: "test-results/pwa-report.json" }]],
  webServer: { command: "node scripts/serve-pwa-test-build.mjs", url: "http://127.0.0.1:4181", reuseExistingServer: false },
});
