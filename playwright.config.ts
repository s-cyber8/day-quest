import { defineConfig, devices } from '@playwright/test';

const mic = { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] };
export default defineConfig({
  testDir: 'tests',
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/day-quest/', trace: 'off', actionTimeout: 4000 },
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173/day-quest/', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'iphone-se', use: { ...devices['iPhone SE (3rd gen)'] }, testMatch: /layout\.spec\.ts/ },
    { name: 'iphone15pm', use: { ...devices['iPhone 15 Pro Max'] }, testMatch: /layout\.spec\.ts/ },
    { name: 'iphone13', use: { ...devices['iPhone 13'] }, testIgnore: /layout\.spec\.ts|audio\.spec\.ts/ },
    { name: 'pixel7', use: { ...devices['Pixel 7'], launchOptions: mic } },
  ],
});
