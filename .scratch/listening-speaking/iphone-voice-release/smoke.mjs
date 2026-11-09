// Loads production assets; all account/review APIs and device voices are fixtures.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium, expect } from '../../../web/node_modules/@playwright/test/index.mjs';

const origin = 'https://learning.peebot.shop';
const item = { id: 'voice-fixture', folder_id: 'fixture-folder', category: 'word', text: '终于', meaning: 'cuối cùng', pinyin: 'zhōng yú', created_at: 1, linked_item_ids: [] };
const session = { id: 'fixture-session', kind: 'vocabulary', position: 0, completed: false, results: {}, ineligible_count: 0,
  settings: { folder_id: null, category: 'all', practice: 'classic', prompt_mode: 'meaning', autoplay: false },
  questions: [{ sentence: null, item_ids: [item.id], items: [item] }] };
const browser = await chromium.launch();
const report = { origin, checkedAt: new Date().toISOString(), browser: browser.version(), boundary: 'production JS/CSS; fixture APIs and speech device, no production data writes', checks: [] };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const health = await context.request.get(`${origin}/api/health`);
  assert.equal(health.status(), 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  await context.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const fixtures = {
      '/api/auth/me': { id: 'fixture-account', username: 'voice-check' },
      '/api/folders': [{ id: 'fixture-folder', name: 'Voice fixture', parent_id: null }],
      '/api/items': [item], '/api/trash': [],
      '/api/review/overview': { entries: [], totals: { remembered: 0, not_yet: 0 } },
      '/api/review/sessions/current': null, '/api/review/sessions': session,
    };
    assert.ok(Object.hasOwn(fixtures, path), `Unexpected API path: ${path}`);
    await route.fulfill({ status: 200, json: fixtures[path] });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => {
    window.__voiceMode = 'empty';
    window.__spoken = [];
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } } });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      cancel() {},
      getVoices() {
        if (window.__voiceMode === 'english') return [{ lang: 'en-US', name: 'English' }];
        if (window.__voiceMode === 'cantonese') return [{ lang: 'zh-HK', name: 'Cantonese' }];
        return [];
      },
      speak(utterance) {
        window.__spoken.push({ text: utterance.text, lang: utterance.lang, userGesture: navigator.userActivation.isActive });
        if (window.__voiceMode === 'unavailable') utterance.onerror?.({ error: 'language-unavailable' });
        else { utterance.onstart?.({}); utterance.onend?.({}); }
      },
    } });
  });
  await page.goto(origin);
  await page.getByRole('button', { name: 'Mở ôn tập', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();
  await page.getByRole('button', { name: 'Nghe mẫu', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.__spoken), [{ text: '终于', lang: 'zh-CN', userGesture: true }]);
  await expect(page.locator('.practice-feedback')).toHaveCount(0);
  report.checks.push('empty voice list requests zh-CN synchronously during the tap');
  for (const mode of ['english', 'cantonese', 'unavailable']) {
    await page.evaluate(mode => { window.__voiceMode = mode; }, mode);
    await page.getByRole('button', { name: 'Nghe mẫu', exact: true }).click();
    await expect(page.locator('.practice-feedback')).toContainText('Cài đặt → Trợ năng');
    await expect(page.locator('.practice-feedback')).toContainText('Mandarin');
  }
  assert.equal(await page.evaluate(() => window.__spoken.length), 2);
  report.checks.push('missing Mandarin and language-unavailable explain installation; Cantonese is never selected');
  await page.getByRole('button', { name: 'Lật thẻ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lật thẻ', exact: true })).toHaveAttribute('aria-pressed', 'true');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  report.checks.push('flashcard remains usable at phone width with no page errors');
  await page.screenshot({ path: new URL('./production-voice-check.png', import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'), fullPage: true });
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(new URL('./smoke.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
}
