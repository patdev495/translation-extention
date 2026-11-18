import { expect, test } from '@playwright/test';

test('a learner grants and revokes read-only access to a nested folder', async ({ page, browser, baseURL }, testInfo) => {
  const headers = { Origin: new URL(baseURL!).origin };
  const suffix = `${testInfo.project.name}_${Date.now()}`;
  const username = `viewer_${suffix}`;
  const viewerContext = await browser.newContext({ ...testInfo.project.use, baseURL });
  try {
    const viewer = await viewerContext.newPage();
    for (const [client, name] of [[page, `owner_${suffix}`], [viewer, username]] as const) {
      const response = await client.request.post('/api/auth/register', {
        headers, data: { username: name, password: 'test-password' },
      });
      expect(response.status()).toBe(201);
    }
    const createFolder = async (name: string, parent_id: string | null = null) => {
      const response = await page.request.post('/api/folders', { headers, data: { name, parent_id } });
      expect(response.status()).toBe(201);
      return (await response.json()).id as string;
    };
    const parent = await createFolder('Khóa học riêng');
    const shared = await createFolder('Bài được chia sẻ', parent);
    const child = await createFolder('Luyện từ vựng', shared);
    expect((await page.request.post('/api/items', {
      headers, data: { folder_id: child, category: 'word', text: '学习', meaning: 'học tập' },
    })).status()).toBe(201);

    await page.goto('/');
    await page.getByRole('button', { name: 'Mở thư mục Khóa học riêng' }).click();
    await page.getByRole('button', { name: 'Tùy chọn Bài được chia sẻ trong lưới' }).tap();
    await page.getByRole('menuitem', { name: 'Chia sẻ' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Chia sẻ “Bài được chia sẻ”' });
    await dialog.getByLabel('Tên đăng nhập người nhận').fill(username);
    await dialog.getByRole('button', { name: 'Cấp quyền xem' }).click();
    const revoke = dialog.getByRole('button', { name: `Thu hồi quyền xem của ${username}` });
    await expect(revoke).toBeEnabled();

    await viewer.goto('/');
    await viewer.getByRole('button', { name: 'Được chia sẻ với tôi' }).click();
    await viewer.getByRole('button', { name: /Bài được chia sẻ/ }).click();
    await expect(viewer.getByText('Chỉ xem', { exact: false })).toBeVisible();
    await viewer.getByRole('button', { name: 'Luyện từ vựng' }).click();
    await expect(viewer.getByRole('heading', { name: '学习' })).toBeVisible();
    await expect(viewer.getByText('học tập', { exact: true })).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Sửa 学习' })).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: 'Xóa 学习' })).toHaveCount(0);
    await expect(viewer.getByText('Khóa học riêng')).toHaveCount(0);

    await revoke.click();
    await expect(dialog.getByText('Chưa cấp quyền xem trực tiếp cho ai.')).toBeVisible();
    await viewer.getByRole('button', { name: 'Tất cả thư mục được chia sẻ' }).click();
    await expect(viewer.getByText('Chưa có thư mục nào được chia sẻ với bạn.')).toBeVisible();
  } finally {
    await viewerContext.close();
  }
});
