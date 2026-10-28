import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run against npm run dev. Puppeteer is a verification tool, not a product dependency.
const root = process.env.HALLMARK_PUPPETEER || process.cwd();
const require = createRequire(resolve(root, 'noop.js'));
const puppeteer = (await import(pathToFileURL(require.resolve('puppeteer-core')).href)).default;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const origin = process.env.UI_PREVIEW_URL || 'http://127.0.0.1:5173';
const out = resolve('.hallmark/checks');
mkdirSync(out, { recursive: true });
const errors = [];
const checks = [];

async function open(path, width = 640, height = 600) {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width, height });
  await page.goto(origin + path, { waitUntil: 'networkidle0' });
  return page;
}
async function saved(page, property, value) {
  await page.waitForFunction((property, value) => {
    return JSON.parse(sessionStorage.getItem('polytranslate-preview')).settings?.[property] === value;
  }, {}, property, value);
}

try {
  const popup = await open('/popup/index.html');
  await popup.waitForFunction(() => document.querySelector('#input-replacement-shortcut').value.length > 0);
  assert.equal(await popup.$$eval('input, select', fields => fields.length), 17);
  await popup.select('#primary-lang', 'en');
  await saved(popup, 'primaryTargetLang', 'en');
  await popup.reload({ waitUntil: 'networkidle0' });
  assert.equal(await popup.$eval('#primary-lang', element => element.value), 'en');
  await popup.select('#primary-lang', 'vi');
  await saved(popup, 'primaryTargetLang', 'vi');
  checks.push('settings persist across reload');

  await popup.select('#provider', 'deepl');
  await popup.waitForFunction(() => !document.querySelector('#deepl-key-container').classList.contains('hidden'));
  assert.match(await popup.$eval('#deepl-key-status', element => element.textContent), /Please enter/);
  await popup.click('#toggle-deepl-key');
  assert.equal(await popup.$eval('#deepl-api-key', element => element.type), 'text');
  await popup.click('#toggle-deepl-key');
  await popup.screenshot({ path: resolve(out, 'popup-deepl.png'), fullPage: true });
  await popup.select('#provider', 'google');
  checks.push('DeepL disclosure and API key visibility');

  await popup.click('#input-replacement-shortcut');
  await popup.keyboard.down('Control');
  await popup.keyboard.press('Space');
  await popup.keyboard.up('Control');
  assert.equal(await popup.$eval('#input-replacement-shortcut', element => element.getAttribute('aria-invalid')), 'true');
  assert.match(await popup.$eval('#input-replacement-error', element => element.textContent), /OCR/);
  await popup.screenshot({ path: resolve(out, 'popup-shortcut-error.png'), fullPage: true });
  await popup.click('#input-replacement-enabled');
  assert.equal(await popup.$eval('#input-replacement-shortcut', element => element.disabled), true);
  await popup.click('#input-replacement-enabled');
  await popup.select('#primary-lang', 'none');
  await saved(popup, 'inputReplacementEnabled', false);
  assert.equal(await popup.$eval('#input-replacement-enabled', element => element.checked), false);
  await popup.select('#primary-lang', 'vi');
  await popup.click('#input-replacement-enabled');
  checks.push('shortcut conflict and unavailable primary language');

  await popup.select('#ocr-model-tier', 'tiny');
  await saved(popup, 'ocrModelTier', 'tiny');
  await popup.reload({ waitUntil: 'networkidle0' });
  assert.equal(await popup.$eval('#ocr-model-tier', element => element.value), 'tiny');
  await popup.select('#ocr-model-tier', 'medium');
  await popup.$eval('#primary-lang', element => element.focus());
  const focus = await popup.$eval('#primary-lang', element => {
    const style = getComputedStyle(element);
    return [style.outlineStyle, style.outlineWidth];
  });
  assert.deepEqual(focus, ['solid', '2px']);
  await popup.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  await popup.screenshot({ path: resolve(out, 'popup-640x600.png') });
  await popup.screenshot({ path: resolve(out, 'popup-full.png'), fullPage: true });
  for (const width of [320, 375, 640]) {
    await popup.setViewport({ width, height: 600 });
    assert.ok(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  checks.push('popup focus, scroll access and 320/375/640px layouts');
  await popup.close();

  for (const state of ['tooltip', 'long']) {
    const page = await open('/scripts/overlay-preview.html?state=' + state, 375, 812);
    await page.waitForFunction(() => document.querySelector('#translation-extension-root')?.shadowRoot?.querySelector('.tt-body'));
    const dimensions = await page.evaluate(() => {
      const shadow = document.querySelector('#translation-extension-root').shadowRoot;
      const tooltip = shadow.querySelector('#tooltip');
      const rectangle = tooltip.getBoundingClientRect();
      return { left: rectangle.left, right: rectangle.right, width: tooltip.clientWidth, scroll: tooltip.scrollWidth };
    });
    assert.ok(dimensions.left >= 0 && dimensions.right <= 376);
    assert.ok(dimensions.scroll <= dimensions.width + 1);
    await page.evaluate(() => document.querySelector('#translation-extension-root').shadowRoot.querySelector('.phonetics-toggle-button').click());
    assert.ok(await page.evaluate(() => [...document.querySelector('#translation-extension-root').shadowRoot.querySelectorAll('.phonetics-container')].every(element => element.classList.contains('hidden'))));
    await page.close();
  }
  checks.push('long multilingual tooltip wraps and phonetics toggle works');

  const pinned = await open('/scripts/overlay-preview.html?state=pinned', 375, 812);
  await pinned.waitForFunction(() => document.querySelector('.polytranslate-pinned-wrapper')?.shadowRoot?.querySelector('.close-btn'));
  await pinned.evaluate(async () => {
    const result = await chrome.storage.local.get('pinned_snippets');
    await chrome.storage.local.set({
      pinned_snippets: result.pinned_snippets.map(snippet => ({ ...snippet, x: 10000, y: 10000 })),
    });
  });
  const close = await pinned.evaluate(() => {
    const rectangle = document.querySelector('.polytranslate-pinned-wrapper').shadowRoot.querySelector('.close-btn').getBoundingClientRect();
    return { left: rectangle.left, right: rectangle.right, top: rectangle.top, bottom: rectangle.bottom };
  });
  assert.ok(close.left >= 0 && close.right <= 375 && close.top >= 0 && close.bottom <= 812);
  await pinned.setViewport({ width: 320, height: 600 });
  await pinned.waitForFunction(() => document.querySelector('.polytranslate-pinned-wrapper').shadowRoot.querySelector('.close-btn').getBoundingClientRect().right <= innerWidth);
  await pinned.evaluate(() => document.querySelector('.polytranslate-pinned-wrapper').shadowRoot.querySelector('.close-btn').click());
  await pinned.waitForFunction(() => !document.querySelector('.polytranslate-pinned-wrapper'));
  await pinned.close();
  checks.push('pinned panel stays on screen, resizes and dismisses through storage sync');

  const pdf = await open('/src/pdf-viewer/viewer.html?file=/__preview__/sample.pdf', 1280, 800);
  await pdf.waitForSelector('.page-wrapper canvas');
  await pdf.waitForFunction(() => document.querySelector('#loading-overlay').hidden);
  const zoom = await pdf.$eval('#zoom-level', element => element.textContent);
  await pdf.click('#btn-zoom-in');
  await pdf.waitForFunction(zoom => document.querySelector('#zoom-level').textContent !== zoom, {}, zoom);
  await pdf.click('#btn-zoom-fit');
  await pdf.click('#btn-ocr-region');
  assert.equal(await pdf.$eval('#btn-ocr-region', element => element.getAttribute('aria-pressed')), 'true');
  await pdf.click('#btn-ocr-region');
  await pdf.screenshot({ path: resolve(out, 'pdf-document.png') });
  // The production password resolver deliberately does not prompt; inspect its retained UI state.
  await pdf.evaluate(() => { document.querySelector('#password-overlay').hidden = false; document.querySelector('#password-input').focus(); });
  await pdf.screenshot({ path: resolve(out, 'pdf-password.png') });
  for (const width of [320, 375, 1280]) {
    await pdf.setViewport({ width, height: 800 });
    assert.ok(await pdf.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await pdf.close();
  checks.push('real PDF rendering, zoom, OCR mode and password surface');

  const host = await open('/scripts/overlay-preview.html?state=none', 1280, 800);
  const before = await host.evaluate(() => {
    document.body.style.cssText = 'background:rgb(32,48,64);color:rgb(241,242,243);font:18px Georgia;width:73%;margin:21px';
    const style = getComputedStyle(document.body);
    return [style.backgroundColor, style.color, style.font, style.width, style.margin];
  });
  await host.addScriptTag({ content: readFileSync('dist/content-script.js', 'utf8') });
  const after = await host.evaluate(() => {
    const style = getComputedStyle(document.body);
    return [style.backgroundColor, style.color, style.font, style.width, style.margin];
  });
  assert.deepEqual(after, before);
  const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
  assert.ok(manifest.content_scripts.every(entry => !entry.css?.length));
  assert.ok(!readFileSync('dist/popup/index.html', 'utf8').includes('extension-preview'));
  await host.close();
  checks.push('built content script preserves host styles; preview shim excluded from production');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, browserErrors: errors, screenshots: out }, null, 2));
} finally {
  await browser.close();
}
