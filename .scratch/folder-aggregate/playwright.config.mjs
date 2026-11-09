import config from '../library-pronunciation/playwright.config.mjs';

export default { ...config, testMatch: 'folder-aggregate.e2e.ts', outputDir: './browser-results' };
