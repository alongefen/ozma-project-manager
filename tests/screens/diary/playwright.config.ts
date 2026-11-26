import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'work-days.spec.ts', workers: 1, reporter: 'line', timeout: 15000,
  use: { baseURL: 'http://127.0.0.1:4178', browserName: 'chromium', channel: 'chrome', locale: 'he-IL', timezoneId: 'Asia/Jerusalem' },
  webServer: { command: 'node browser/server.mjs', url: 'http://127.0.0.1:4178', reuseExistingServer: false },
});
