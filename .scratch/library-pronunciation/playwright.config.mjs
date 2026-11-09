import { defineConfig, devices } from '../../web/node_modules/@playwright/test/index.mjs';

export default defineConfig({
  testDir: '../../web/e2e',
  testMatch: 'library-pronunciation.e2e.ts',
  outputDir: './browser-results',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5178', screenshot: 'only-on-failure' },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium', hasTouch: true } },
  ],
  webServer: {
    command: 'uv run --project web python .scratch/library-pronunciation/server.py',
    cwd: '../..',
    url: 'http://127.0.0.1:5178',
    timeout: 60000,
    reuseExistingServer: false,
  },
});
