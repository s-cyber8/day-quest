import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 240_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/day-quest/', trace: 'off' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/day-quest/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'iphone13', use: { ...devices['iPhone 13'] } },
    { name: 'pixel7', use: { ...devices['Pixel 7'] } },
  ],
});
