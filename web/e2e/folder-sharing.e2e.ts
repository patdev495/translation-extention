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
    const createItem = async (folder_id: string, category: string, text: string, meaning: string) => {
      const result = await page.request.post('/api/items', { headers, data: { folder_id, category, text, meaning } });
      expect(result.status()).toBe(201);
      return (await result.json()).id as string;
    };
    const word = await createItem(child, 'word', '学习', 'học tập');
    const sentence = await createItem(shared, 'sentence', '我在学习。', 'Tôi đang học.');
    expect((await page.request.post(`/api/items/${word}/links`, { headers, data: { item_id: sentence } })).status()).toBe(201);

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
    const tree = guest.getByRole('navigation', { name: 'Cây thư mục' });
    await expect(tree.getByRole('button', { name: 'Bài được chia sẻ' })).toBeVisible();
    await expect(tree.getByRole('button', { name: 'Luyện từ vựng' })).toBeVisible();
    await guest.getByRole('button', { name: 'Mở tất cả danh sách' }).click();
    const items = guest.getByRole('region', { name: /Mục học tập/ });
    await expect(items.getByRole('article')).toHaveCount(2);
    await items.getByRole('combobox', { name: 'Lọc mục học tập' }).selectOption('word');
    await expect(items.getByRole('article')).toHaveCount(1);
    await items.getByRole('combobox', { name: 'Sắp xếp mục học tập' }).selectOption('oldest');
    await expect(items.getByRole('navigation', { name: 'Phân trang mục học tập' })).toBeVisible();
    await guest.getByRole('button', { name: 'Về thư mục' }).click();
    await guest.getByRole('button', { name: 'Mở thư mục Luyện từ vựng' }).click();
    await expect(guest.getByRole('heading', { name: '学习' })).toBeVisible();
    await expect(guest.getByText('học tập', { exact: true })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Phát âm 学习' })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Sửa 学习' })).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Xóa 学习' })).toHaveCount(0);
    await expect(guest.getByRole('button', { name: /Tùy chọn|Dọn sạch|Xóa mục đã chọn/ })).toHaveCount(0);
    await expect(guest.getByText('Khóa học riêng')).toHaveCount(0);

    await guest.getByRole('button', { name: 'Xem 1 câu liên kết của 学习' }).click();
    const links = guest.getByRole('dialog', { name: 'Câu liên kết' });
    await expect(links.getByRole('button', { name: /Sửa/ })).toHaveCount(0);
    await links.getByRole('button', { name: 'Mở 我在学习。' }).click();
    await expect(guest.getByRole('heading', { name: '我在学习。' })).toBeVisible();

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
