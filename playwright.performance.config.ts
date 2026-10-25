import { defineConfig } from "@playwright/test";
import journeys from "./playwright.config";

// Opt-in measurements run alone, on the existing isolated review origin.
export default defineConfig({
  ...journeys, testDir: "./tests/performance", testMatch: "**/*.performance.spec.ts",
  fullyParallel: false, workers: 1, timeout: 180000,
  outputDir: "test-results/performance/browser",
  reporter: [["list"], ["json", { outputFile: "test-results/performance/browser-report.json" }]],
});
