import { expect, test } from '@playwright/test';

test('a learner enables and disables a link that guests can open without an account', async ({ page, browser, baseURL }, testInfo) => {
  const headers = { Origin: new URL(baseURL!).origin };
  const suffix = `${testInfo.project.name}_${Date.now()}`;
  const guestContext = await browser.newContext({ ...testInfo.project.use, baseURL });
  try {
    const guest = await guestContext.newPage();
    const response = await page.request.post('/api/auth/register', {
      headers, data: { username: `owner_${suffix}`, password: 'test-password' },
    });
    expect(response.status()).toBe(201);
    const createFolder = async (name: string, parent_id: string | null = null) => {
      const result = await page.request.post('/api/folders', { headers, data: { name, parent_id } });
      expect(result.status()).toBe(201);
      return (await result.json()).id as string;
    };
    const parent = await createFolder('Khóa học riêng');
    const shared = await createFolder('Bài được chia sẻ', parent);
    const child = await createFolder('Luyện từ vựng', shared);
    expect((await page.request.post('/api/items', {
      headers, data: { folder_id: child, category: 'word', text: '学习', meaning: 'học tập' },
    })).status()).toBe(201);

    await page.goto('/');
    await page.getByRole('button', { name: 'Mở thư mục Khóa học riêng' }).click();
    const folderMenu = page.getByRole('button', { name: 'Tùy chọn Bài được chia sẻ trong lưới' });
    const dialog = page.getByRole('dialog', { name: 'Chia sẻ “Bài được chia sẻ”' });
    const linkField = dialog.getByLabel('Liên kết chỉ xem');
    const openSharing = async () => {
      await folderMenu.tap();
      await page.getByRole('menuitem', { name: 'Chia sẻ' }).tap();
    };

    await openSharing();
    await dialog.getByRole('button', { name: 'Bật liên kết' }).click();
    await expect(linkField).toHaveValue(/#share=[\w-]{43}$/);
    const link = await linkField.inputValue();
    await dialog.getByRole('button', { name: 'Đóng' }).click();
    await openSharing();
    await expect(linkField).toHaveValue(link);

    await guest.goto(link);
    await expect(guest.getByRole('heading', { name: 'Bài được chia sẻ' })).toBeVisible();
    await expect(guest.getByText('Chỉ xem', { exact: true })).toBeVisible();
    await guest.getByRole('button', { name: 'Luyện từ vựng' }).click();
    await expect(guest.getByRole('heading', { name: '学习' })).toBeVisible();
    await expect(guest.getByText('học tập', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Sửa 学习' })).toHaveCount(0);
    await expect(guest.getByText('Khóa học riêng')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Tắt liên kết' }).click();
    await expect(dialog.getByText('Đã tắt liên kết.')).toBeVisible();
    await guest.reload();
    await expect(guest.getByRole('alert')).toHaveText('Liên kết không hợp lệ hoặc đã bị tắt.');
    await dialog.getByRole('button', { name: 'Bật liên kết' }).click();
    await expect(linkField).toHaveValue(/#share=[\w-]{43}$/);
    const replacement = await linkField.inputValue();
    expect(replacement).not.toEqual(link);
    await guest.goto(replacement);
    await expect(guest.getByRole('heading', { name: 'Bài được chia sẻ' })).toBeVisible();
  } finally {
    await guestContext.close();
  }
});
