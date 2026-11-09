import { expect, test } from '@playwright/test';

test('a parent folder opens all descendant categories as one ordinary list', async ({ page }, testInfo) => {
  const headers = { Origin: new URL(testInfo.project.use.baseURL!).origin };
  expect((await page.request.post('/api/auth/register', {
    headers, data: { username: `aggregate_${Date.now()}_${Math.floor(Math.random() * 100000)}`, password: 'test-password' },
  })).status()).toBe(201);
  async function folder(name: string, parent_id: string | null = null) {
    const response = await page.request.post('/api/folders', { headers, data: { name, parent_id } });
    expect(response.status()).toBe(201);
    return (await response.json()).id as string;
  }
  const root = await folder('Khóa học');
  const child = await folder('Bài 1', root);
  const deep = await folder('Phần nhỏ', child);
  const outside = await folder('Khác');
  const entries = [];
  for (const item of [
    { category: 'word', text: '学习', meaning: 'học', folder_id: root },
    { category: 'sentence', text: '我喜欢学习中文。', meaning: 'Tôi thích học tiếng Trung.', folder_id: child },
    { category: 'grammar', text: '把 + N + V', meaning: 'Cấu trúc câu với 把', folder_id: deep },
    { category: 'note', text: 'Ghi chú bài học', meaning: 'Ôn lại các thanh điệu.', folder_id: deep },
    { category: 'note', text: 'Ghi chú ngoài phạm vi', meaning: 'Không thuộc khóa học.', folder_id: outside },
  ]) {
    const response = await page.request.post('/api/items', { headers, data: item });
    expect(response.status()).toBe(201);
    entries.push(await response.json());
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở thư mục Khóa học', exact: true }).click();
  await expect(page.locator('.saved-item-row')).toHaveCount(1);
  const openAll = page.getByRole('button', { name: 'Mở tất cả danh sách', exact: true });
  const box = await openAll.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await openAll.click();
  await expect(page.locator('.saved-item-row')).toHaveCount(4);
  await expect(page.locator('.child-folders')).toHaveCount(0);
  await expect(page.locator(`#learning-item-${entries[4].id}`)).toHaveCount(0);
  await expect(page.locator('.library-pronunciation-button')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('aggregate-folder.png'), fullPage: true });
  const category = page.getByRole('combobox', { name: 'Lọc mục học tập', exact: true });
  for (const [index, value] of ['word', 'sentence', 'grammar', 'note'].entries()) {
    await category.selectOption(value);
    await expect(page.locator('.saved-item-row')).toHaveCount(1);
    await expect(page.locator('.saved-item-row')).toHaveAttribute('id', `learning-item-${entries[index].id}`);
  }
  await category.selectOption('all');
  await page.getByRole('checkbox', { name: 'Chọn 学习', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Chọn Ghi chú bài học', exact: true }).check();
  await page.getByRole('button', { name: 'Xóa mục đã chọn', exact: true }).click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.locator('.saved-item-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Dọn sạch thư mục', exact: true }).click();
  await expect(page.locator('.confirm-dialog')).toContainText('các thư mục con');
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.locator('.saved-item-row')).toHaveCount(0);
  const remaining = await (await page.request.get('/api/items')).json();
  expect(remaining.map((item: { id: string }) => item.id)).toEqual([entries[4].id]);
  expect((await (await page.request.get('/api/folders')).json()).length).toBe(4);
  await page.getByRole('button', { name: 'Về thư mục', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở thư mục Bài 1', exact: true })).toBeVisible();
});
