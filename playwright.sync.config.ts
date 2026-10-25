import {defineConfig}from"@playwright/test";
import auth from"./playwright.auth.config.ts";
export default defineConfig({...auth,testDir:"./tests/sync",testMatch:"**/*.sync.spec.ts",timeout:60000,outputDir:"test-results/sync/browser",reporter:[["list"],["json",{outputFile:"test-results/sync/browser-report.json"}]]});
