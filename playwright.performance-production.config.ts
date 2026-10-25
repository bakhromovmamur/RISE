import { defineConfig } from "@playwright/test";
import production from "./playwright.production.config";

// Run separately from the PWA/production suites sharing isolated port 4181.
export default defineConfig({
  ...production, testDir: "./tests/performance", testMatch: "**/*.production-performance.spec.ts",
  fullyParallel: false, workers: 1, timeout: 180000,
  outputDir: "test-results/performance/production",
  reporter: [["list"], ["json", { outputFile: "test-results/performance/production-report.json" }]],
});
