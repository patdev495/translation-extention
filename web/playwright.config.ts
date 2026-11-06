import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'mobile-chromium', use: {
      ...devices['Pixel 7'], browserName: 'chromium', permissions: ['microphone'],
      launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    } },
  ],
  webServer: {
    command: 'uv run --project . python e2e/server.py',
    url: 'http://127.0.0.1:5174',
    timeout: 60000,
    reuseExistingServer: false,
  },
});
