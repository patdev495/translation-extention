import { expect, test, type Page } from '@playwright/test';

async function openPractice(page: Page, longContent = false) {
  const headers = { Origin: 'http://127.0.0.1:5174' };
  const username = `practice_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const registered = await page.request.post('/api/auth/register', { headers, data: { username, password: 'test-password' } });
  expect(registered.status()).toBe(201);
  const folder = await (await page.request.post('/api/folders', { headers, data: { name: 'Học giao tiếp' } })).json();
  const items = longContent ? [{ category: 'sentence', text: '我终于找到工作了。'.repeat(80), meaning: 'Cuối cùng tôi đã tìm được việc. '.repeat(80) }] : [
    { category: 'word', text: '终于', meaning: 'cuối cùng' },
    { category: 'word', text: '工作', meaning: 'công việc' },
    { category: 'sentence', text: '我终于找到工作了。', meaning: 'Cuối cùng tôi đã tìm được việc.' },
  ];
  for (const item of items) expect((await page.request.post('/api/items', { headers, data: { folder_id: folder.id, ...item } })).status()).toBe(201);
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở ôn tập', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();
}

test('mobile flashcards keep the card and large audio and assessment controls together', async ({ page }, testInfo) => {
  await openPractice(page);
  await expect(page.getByRole('button', { name: 'Lật thẻ', exact: true })).toBeVisible();
  await expect(page.locator('details.practice-setup')).toHaveJSProperty('open', false);
  for (const name of ['Nghe mẫu', 'Thu âm', 'Nghe bản thu', 'Nhớ', 'Chưa nhớ', 'Lùi', 'Tiếp']) {
    const button = page.getByRole('button', { name, exact: true });
    const box = await button.boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
    expect(box!.width, name).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height, name).toBeLessThanOrEqual(page.viewportSize()!.height);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('flashcards-phone.png'), fullPage: true });
  await page.getByRole('button', { name: 'Lật thẻ', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Lật thẻ', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Tiếp', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Lật thẻ', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.review-statistics')).toContainText('Đã nhớ 0');
});

test('recording is temporary while practice progress survives a reload', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    // Windows WebKit does not ship media capture. Test its UI at the device seam;
    // Chromium below uses native MediaRecorder and native audio playback.
    if (typeof MediaRecorder === 'undefined' || typeof AudioContext === 'undefined') {
      Object.defineProperty(window, '__practiceMediaBoundary', { value: 'device-double' });
      Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => {
        const track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
        return { getTracks: () => [track] };
      } } });
      Object.defineProperty(window, 'MediaRecorder', { value: class extends EventTarget {
        static isTypeSupported(type: string) { return type === 'audio/mp4'; }
        state = 'inactive';
        mimeType = 'audio/mp4';
        start() { this.state = 'recording'; }
        stop() {
          this.state = 'inactive';
          queueMicrotask(() => {
            this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['fixture-audio'], { type: 'audio/mp4' }) }));
            this.dispatchEvent(new Event('stop'));
          });
        }
      } });
      Object.defineProperty(window, 'Audio', { value: class extends EventTarget {
        constructor(public src: string) { super(); }
        play() { return Promise.resolve(); }
        pause() {}
      } });
      return;
    }
    Object.defineProperty(window, '__practiceMediaBoundary', { value: 'native-recorder' });
    // Chromium's fake input device is configured at launch; capture, encoding
    // and playback use the unmodified browser APIs.
  });
  const writes: string[] = [];
  page.on('request', request => { if (['POST', 'PUT', 'PATCH'].includes(request.method())) writes.push(request.headers()['content-type'] ?? ''); });
  await openPractice(page);
  testInfo.annotations.push({ type: 'media-boundary', description: await page.evaluate(() => (window as unknown as { __practiceMediaBoundary: string }).__practiceMediaBoundary) });
  await page.getByRole('button', { name: 'Nhớ', exact: true }).click();
  await expect(page.locator('.practice-progress')).toContainText('2 / 3');
  const expectedFront = await page.locator('.review-front').innerText();
  const saved = await (await page.request.get('/api/review/sessions/current')).json();
  await page.getByRole('button', { name: 'Thu âm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dừng thu âm', exact: true })).toBeEnabled();
  await page.waitForTimeout(800); // Capture a non-empty segment of real encoded audio.
  await page.getByRole('button', { name: 'Dừng thu âm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nghe bản thu', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Nghe bản thu', exact: true }).click();
  await expect(page.locator('.practice-feedback')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tiếp', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nghe bản thu', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Lùi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nghe bản thu', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Thu âm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dừng thu âm', exact: true })).toBeEnabled();
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Thu âm', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Nghe bản thu', exact: true })).toBeEnabled();
  await page.evaluate(() => { Reflect.deleteProperty(document, 'visibilityState'); });
  await page.reload();
  await page.getByRole('button', { name: 'Mở ôn tập', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp tục bài dở', exact: true }).click();
  await expect(page.locator('.practice-progress')).toContainText('2 / 3');
  await expect(page.locator('.review-front')).toHaveText(expectedFront);
  await expect(page.getByRole('button', { name: 'Nghe bản thu', exact: true })).toBeDisabled();
  const resumed = await (await page.request.get('/api/review/sessions/current')).json();
  expect(resumed.id).toBe(saved.id);
  expect(resumed.results).toEqual(saved.results);
  expect(resumed.questions).toEqual(saved.questions);
  expect(writes.every(type => type.startsWith('application/json'))).toBe(true);
  await page.getByRole('button', { name: 'Kết thúc luyện', exact: true }).click();
  await expect(page.locator('.review-summary')).toContainText('Đã nhớ: 1 · Chưa nhớ: 0');
  expect(await (await page.request.get('/api/review/sessions/current')).json()).toBeNull();
});

test('long saved sentences scroll inside the card while phone controls stay reachable', async ({ page }) => {
  await openPractice(page, true);
  expect(await page.locator('.review-card-face-front').evaluate(face => {
    const text = face.querySelector('.review-front')!;
    return face.scrollHeight > face.clientHeight || text.scrollHeight > text.clientHeight;
  })).toBe(true);
  await page.getByRole('button', { name: 'Lật thẻ', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Lật thẻ', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const recordButton = await page.getByRole('button', { name: 'Thu âm', exact: true }).boundingBox();
  expect(recordButton!.y + recordButton!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
