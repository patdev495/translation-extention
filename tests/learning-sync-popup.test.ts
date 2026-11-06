// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

test('popup shows pending, completed, failed saves and retries failures', async () => {
  vi.resetModules();
  const html = readFileSync(resolve(__dirname, '../popup/index.html'), 'utf8');
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  const sendMessage = vi.fn(async (message: { type: string }) => {
    if (message.type === 'GET_ACCOUNT_LINK_STATUS') return { success: true, status: { state: 'linked', username: 'learner', webUrl: 'https://custom.example' } };
    if (message.type === 'LEARNING_SYNC_STATUS' || message.type === 'LEARNING_SYNC_RETRY') return { success: true, result: [
      { id: 'one', account_id: 'user-1', choice: 'word', item: { text: '你好' }, state: 'pending' },
      { id: 'two', account_id: 'user-1', choice: 'word', item: { text: '学习' }, state: 'completed' },
      { id: 'three', account_id: 'user-1', choice: 'sentence', item: { text: '我学习。' }, state: 'failed', error: 'Folder not found' },
    ] };
    return undefined;
  });
  vi.stubGlobal('chrome', {
    storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener: vi.fn() } },
    tabs: { query: vi.fn((_query, callback) => callback([])) },
    runtime: { sendMessage },
  });
  await import('../popup/popup');

  await vi.waitFor(() => expect(document.getElementById('learning-sync-list')?.textContent).toContain('你好'));
  const webLink = document.getElementById('learning-account-web-url') as HTMLAnchorElement;
  expect(webLink.href).toBe('https://custom.example/');
  expect(webLink.textContent).toBe('https://custom.example/');
  const text = document.getElementById('learning-sync-list')!.textContent!;
  expect(text).toContain('Chờ đồng bộ');
  expect(text).toContain('Đã đồng bộ');
  expect(text).toContain('Thất bại');
  document.getElementById('learning-sync-retry')!.click();
  await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: 'LEARNING_SYNC_RETRY' }));
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });
