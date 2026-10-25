import{defineConfig}from"@playwright/test";
import auth from"./playwright.auth.config.ts";
export default defineConfig({...auth,testDir:"./tests/push",testMatch:"**/*.push.spec.ts",timeout:60000,outputDir:"test-results/push/browser",reporter:[["list"],["json",{outputFile:"test-results/push/browser-report.json"}]]});
