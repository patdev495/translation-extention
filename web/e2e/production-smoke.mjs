// Explicit production check; not collected by npm test or test:e2e.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const origin = process.argv[2];
assert.equal(origin, 'https://learning.peebot.shop');
const directory = resolve(process.argv[3] ?? '.');
await mkdir(directory, { recursive: true });
const report = { origin, checkedAt: new Date().toISOString(), checks: [] };
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
try {
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['microphone'] });
  const headers = { Origin: origin };
  const registered = await context.request.post('/api/auth/register', {
    headers, data: { username: `release_${Date.now()}`, password: randomUUID() },
  });
  assert.equal(registered.status(), 201);
  report.fixture = await registered.json();
  console.log(JSON.stringify({ createdFixture: report.fixture }));
  const folder = await (await context.request.post('/api/folders', { headers, data: { name: 'Release smoke check' } })).json();
  for (const item of [
    { category: 'word', text: '终于', meaning: 'cuối cùng' },
    { category: 'sentence', text: '我终于找到工作了。', meaning: 'Cuối cùng tôi đã tìm được việc.' },
  ]) assert.equal((await context.request.post('/api/items', { headers, data: { folder_id: folder.id, ...item } })).status(), 201);
  const page = await context.newPage();
  const writes = [];
  page.on('request', request => { if (['POST', 'PUT', 'PATCH'].includes(request.method())) writes.push(request.headers()['content-type'] ?? ''); });
  await page.addInitScript(() => {
    window.__smokeClips = [];
    window.__smokePlayback = false;
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      if (blob instanceof Blob) window.__smokeClips.push({ size: blob.size, type: blob.type });
      return create(blob);
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const result = play.call(this);
      result.then(() => { window.__smokePlayback = true; }, () => {});
      return result;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở ôn tập', exact: true }).click();
  await expect(page.getByLabel('Cách luyện')).toHaveValue('classic');
  await expect(page.getByLabel('Mặt trước flashcard').locator('option')).toHaveCount(3);
  await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();
  await expect(page.locator('.practice-progress')).toContainText('1 / 2');
  await page.getByRole('button', { name: 'Nhớ', exact: true }).click();
  await expect(page.locator('.practice-progress')).toContainText('2 / 2');
  const front = await page.locator('.review-front').innerText();
  const saved = await (await context.request.get('/api/review/sessions/current')).json();
  assert.equal(saved.position, 1);
  assert.equal(Object.values(saved.results).filter(result => result === 'remembered').length, 1);
  report.checks.push('saved word/sentence flashcards and explicit assessment');
  await page.getByRole('button', { name: 'Thu âm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dừng thu âm', exact: true })).toBeEnabled();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Dừng thu âm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nghe bản thu', exact: true })).toBeEnabled();
  report.clips = await page.evaluate(() => window.__smokeClips);
  assert.ok(report.clips.some(clip => clip.size > 0));
  await page.getByRole('button', { name: 'Nghe bản thu', exact: true }).click();
  await page.waitForFunction(() => window.__smokePlayback);
  assert.ok(writes.every(type => type.startsWith('application/json')));
  report.checks.push('native microphone/encoding/playback with browser fake input; no audio upload');
  await page.reload();
  await page.getByRole('button', { name: 'Mở ôn tập', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục bài dở', exact: true }).click();
  await expect(page.locator('.review-front')).toHaveText(front);
  await expect(page.getByRole('button', { name: 'Nghe bản thu', exact: true })).toBeDisabled();
  const resumed = await (await context.request.get('/api/review/sessions/current')).json();
  assert.equal(resumed.id, saved.id);
  assert.deepEqual(resumed.questions, saved.questions);
  assert.deepEqual(resumed.results, saved.results);
  report.checks.push('resume same session, order, cursor and assessments; discard recording on reload');
  report.screenshot = resolve(directory, 'production-phone.png');
  await page.screenshot({ path: report.screenshot, fullPage: true });
  await page.getByRole('button', { name: 'Kết thúc luyện', exact: true }).click();
  await expect(page.locator('.review-summary')).toContainText('Đã nhớ: 1 · Chưa nhớ: 0');
  assert.equal(await (await context.request.get('/api/review/sessions/current')).json(), null);
  report.checks.push('finish practice removes unfinished session');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = String(error);
  process.exitCode = 1;
} finally {
  await writeFile(resolve(directory, 'production-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
}
