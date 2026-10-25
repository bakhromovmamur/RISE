import {defineConfig} from '@playwright/test';
import auth from './playwright.auth.config.ts';
export default defineConfig({...auth,testDir:'./tests/groups',testMatch:'**/*.groups.spec.ts',timeout:90000,outputDir:'test-results/groups/browser',reporter:[['list'],['json',{outputFile:'test-results/groups/browser-report.json'}]]});
