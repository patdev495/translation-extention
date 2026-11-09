import { expect, test } from '@playwright/test';

test('library and linked sentences have touchable pronunciation controls without starting review', async ({ page }, testInfo) => {
  const headers = { Origin: new URL(testInfo.project.use.baseURL!).origin };
  const registered = await page.request.post('/api/auth/register', {
    headers, data: { username: `voice_${Date.now()}_${Math.floor(Math.random() * 100000)}`, password: 'test-password' },
  });
  expect(registered.status()).toBe(201);
  const folder = await (await page.request.post('/api/folders', { headers, data: { name: 'Học phát âm' } })).json();
  const entries = [];
  for (const item of [
    { category: 'word', text: '学习', meaning: 'học' },
    { category: 'sentence', text: '我喜欢学习中文。', meaning: 'Tôi thích học tiếng Trung.' },
  ]) {
    const response = await page.request.post('/api/items', { headers, data: { folder_id: folder.id, ...item } });
    expect(response.status()).toBe(201);
    entries.push(await response.json());
  }
  expect((await page.request.post(`/api/items/${entries[0].id}/links`, { headers, data: { item_id: entries[1].id } })).status()).toBe(201);
  await page.addInitScript(() => {
    const state = { spoken: [] as { text: string; lang: string }[] };
    Object.assign(window, { __librarySpeech: state });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(public text: string) {} } });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => [{ lang: 'zh-CN', name: 'Mandarin' }], cancel() {},
      speak(utterance: SpeechSynthesisUtterance) {
        state.spoken.push({ text: utterance.text, lang: utterance.lang });
        utterance.onstart?.({} as SpeechSynthesisEvent);
      },
    } });
  });
  await page.goto('/');
  for (const text of ['学习', '我喜欢学习中文。']) {
    const button = page.getByRole('button', { name: `Phát âm ${text}`, exact: true });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await button.tap();
    await expect(page.getByRole('button', { name: `Dừng phát âm ${text}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  expect(await page.evaluate(() => (window as unknown as { __librarySpeech: { spoken: unknown[] } }).__librarySpeech.spoken))
    .toEqual([{ text: '学习', lang: 'zh-CN' }, { text: '我喜欢学习中文。', lang: 'zh-CN' }]);
  await page.getByRole('button', { name: 'Dừng phát âm 我喜欢学习中文。', exact: true }).tap();
  await expect(page.locator('.library-pronunciation-button[aria-pressed="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('library-pronunciation-phone.png'), fullPage: true });
  await page.getByRole('button', { name: 'Xem 1 câu liên kết của 学习', exact: true }).tap();
  const dialog = page.getByRole('dialog', { name: 'Câu liên kết', exact: true });
  const linkedButton = dialog.getByRole('button', { name: 'Phát âm 我喜欢学习中文。', exact: true });
  const box = await linkedButton.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await linkedButton.tap();
  await expect(dialog.getByRole('button', { name: 'Dừng phát âm 我喜欢学习中文。', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng mục liên kết', exact: true }).tap();
  await expect(page.locator('.library-pronunciation-button[aria-pressed="true"]')).toHaveCount(0);
  expect(await (await page.request.get('/api/review/sessions/current')).json()).toBeNull();
});
