import {defineConfig} from '@playwright/test';
import auth from './playwright.auth.config.ts';
export default defineConfig({...auth,testDir:'./tests/rollout',testMatch:'**/*.rollout.spec.ts',timeout:180000,
  outputDir:'test-results/rollout/browser',reporter:[['list'],['json',{outputFile:'test-results/rollout/browser-report.json'}]],
  webServer:{command:'node --import tsx scripts/infra/serve-rollout-test.ts',url:'http://127.0.0.1:4191/api/v1/health/ready',reuseExistingServer:false,timeout:180000,gracefulShutdown:{signal:'SIGTERM',timeout:20000}}});
