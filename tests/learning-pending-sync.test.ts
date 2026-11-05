import { afterEach, expect, test, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

test('offline save survives service worker restart and syncs once when online', async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('__LEARNING_API_BASE__', 'http://127.0.0.1:8000');
  const local = new Map<string, unknown>();
  let messageHandler: (message: any, sender: unknown, respond: (value: any) => void) => void = () => {};
  let alarmHandler: (alarm: { name: string }) => void = () => {};
  let startupHandler: () => void = () => {};
  const alarms = new Set<string>();
  vi.stubGlobal('chrome', {
    webNavigation: { onBeforeNavigate: { addListener: vi.fn() } },
    runtime: {
      getURL: (path: string) => path,
      onMessage: { addListener: (handler: typeof messageHandler) => { messageHandler = handler; } },
      onStartup: { addListener: (handler: typeof startupHandler) => { startupHandler = handler; } },
    },
    storage: { local: {
      get: async (key: string) => ({ [key]: local.get(key) }),
      set: async (items: Record<string, unknown>) => { for (const [key, value] of Object.entries(items)) local.set(key, value); },
    } },
    alarms: {
      create: async (name: string) => { alarms.add(name); },
      clear: async (name: string) => { alarms.delete(name); },
      onAlarm: { addListener: (handler: typeof alarmHandler) => { alarmHandler = handler; } },
    },
    tabs: { create: vi.fn(async () => {}) },
  });
  let online = false;
  const uploaded: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/api/link/start')) return { ok: true, json: async () => ({ request_id: 'link-1', poll_secret: 'secret', approve_url: 'http://local', expires_at: Math.floor(Date.now() / 1000) + 300 }) };
    if (url.endsWith('/api/link/poll')) return { ok: true, json: async () => ({ state: 'linked', token: 'token-1', account: { id: 'alice', username: 'alice' } }) };
    if (url.endsWith('/api/extension/sync')) {
      if (!online) throw new TypeError('Failed to fetch');
      uploaded.push(JSON.parse(String(options?.body)));
      return { ok: true, json: async () => ({ id: 'saved-1', text: '你好' }) };
    }
    throw new Error(`Unexpected request ${url}`);
  }));
  const link = await import('../src/background/learning-account-link');
  await link.startAccountLink();
  await link.pollAccountLink();
  await import('../src/background/service-worker');
  const send = (message: unknown) => new Promise<any>((resolve) => messageHandler(message, {}, resolve));

  const saved = await send({ type: 'LEARNING_SAVE', choice: 'word', item: { folder_id: 'folder-1', category: 'word', text: '你好', meaning: 'xin chào' } });
  expect(saved).toMatchObject({ success: true, state: 'pending' });
  expect((await send({ type: 'LEARNING_SYNC_STATUS' })).result).toMatchObject([{ state: 'pending', account_id: 'alice', pinyin: 'nǐ hǎo' }]);

  vi.resetModules();
  await import('../src/background/service-worker');
  startupHandler();
  online = true;
  await vi.waitFor(() => expect(alarms.has('polytranslate-learning-sync')).toBe(true));
  alarmHandler({ name: 'polytranslate-learning-sync' });
  await vi.waitFor(async () => expect((await send({ type: 'LEARNING_SYNC_STATUS' })).result).toMatchObject([{ state: 'completed' }]));
  expect(uploaded).toHaveLength(1);
  expect(uploaded[0]).toMatchObject({ choice: 'word', item: { folder_id: 'folder-1', text: '你好', meaning: 'xin chào' } });
});

test('linked pair remains with its original account across account switching', async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('__LEARNING_API_BASE__', 'http://127.0.0.1:8000');
  let account = 'alice';
  let online = false;
  let messageHandler: (message: any, sender: unknown, respond: (value: any) => void) => void = () => {};
  let alarmHandler: (alarm: { name: string }) => void = () => {};
  vi.stubGlobal('chrome', {
    webNavigation: { onBeforeNavigate: { addListener: vi.fn() } },
    runtime: { getURL: (path: string) => path, onMessage: { addListener: (handler: typeof messageHandler) => { messageHandler = handler; } }, onStartup: { addListener: vi.fn() } },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener: (handler: typeof alarmHandler) => { alarmHandler = handler; } } },
    tabs: { create: async () => {} },
  });
  const uploaded: Array<{ token: string; body: any }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/api/link/start')) return { ok: true, json: async () => ({ request_id: `link-${account}`, poll_secret: 'secret', approve_url: 'http://local', expires_at: Math.floor(Date.now() / 1000) + 300 }) };
    if (url.endsWith('/api/link/poll')) return { ok: true, json: async () => ({ state: 'linked', token: `token-${account}`, account: { id: account, username: account } }) };
    if (url.endsWith('/api/extension/revoke')) return { ok: true, status: 204 };
    if (url.endsWith('/api/extension/sync')) {
      if (!online) throw new TypeError('Failed to fetch');
      uploaded.push({ token: String((options?.headers as Record<string, string>).Authorization), body: JSON.parse(String(options?.body)) });
      return { ok: true, json: async () => ({ word: { id: 'w1' }, sentence: { id: 's1' } }) };
    }
    throw new Error(`Unexpected request ${url}`);
  }));
  const link = await import('../src/background/learning-account-link');
  await link.startAccountLink();
  await link.pollAccountLink();
  await import('../src/background/service-worker');
  const send = (message: unknown) => new Promise<any>((resolve) => messageHandler(message, {}, resolve));

  const saved = await send({ type: 'LEARNING_SAVE', choice: 'both', item: {
    folder_id: 'f1', word_text: '学习', word_meaning: 'học', sentence_text: '我学习中文。', sentence_meaning: 'Tôi học tiếng Trung.',
  } });
  expect(saved.state).toBe('pending');
  expect(saved.result).toMatchObject({ pinyin: 'xué xí', sentence_pinyin: expect.stringContaining('xué xí') });
  await link.unlinkAccount();
  account = 'bob';
  await link.startAccountLink();
  await link.pollAccountLink();
  online = true;
  alarmHandler({ name: 'polytranslate-learning-sync' });
  expect((await send({ type: 'LEARNING_SYNC_STATUS' })).result).toEqual([]);
  expect(uploaded).toEqual([]);

  await link.unlinkAccount();
  account = 'alice';
  await link.startAccountLink();
  await link.pollAccountLink();
  await vi.waitFor(() => expect(uploaded).toHaveLength(1));
  expect(uploaded[0]).toMatchObject({ token: 'Bearer token-alice', body: { choice: 'both', item: { folder_id: 'f1', word_text: '学习', sentence_text: '我学习中文。' } } });
  expect((await send({ type: 'LEARNING_SYNC_STATUS' })).result).toMatchObject([{ state: 'completed', account_id: 'alice' }]);
});

test('failed save can be retried after learner fixes server error', async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('__LEARNING_API_BASE__', 'http://127.0.0.1:8000');
  let messageHandler: (message: any, sender: unknown, respond: (value: any) => void) => void = () => {};
  vi.stubGlobal('chrome', {
    webNavigation: { onBeforeNavigate: { addListener: vi.fn() } },
    runtime: { getURL: (path: string) => path, onMessage: { addListener: (handler: typeof messageHandler) => { messageHandler = handler; } }, onStartup: { addListener: vi.fn() } },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener: vi.fn() } },
    tabs: { create: async () => {} },
  });
  let fixed = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/api/link/start')) return { ok: true, json: async () => ({ request_id: 'link-1', poll_secret: 'secret', approve_url: 'http://local', expires_at: Math.floor(Date.now() / 1000) + 300 }) };
    if (url.endsWith('/api/link/poll')) return { ok: true, json: async () => ({ state: 'linked', token: 'token', account: { id: 'alice', username: 'alice' } }) };
    if (url.endsWith('/api/extension/sync')) return fixed
      ? { ok: true, json: async () => ({ id: 'saved-1' }) }
      : { ok: false, status: 404, json: async () => ({ detail: 'Learning Folder not found' }) };
    throw new Error(`Unexpected request ${url}`);
  }));
  const link = await import('../src/background/learning-account-link');
  await link.startAccountLink();
  await link.pollAccountLink();
  await import('../src/background/service-worker');
  const send = (message: unknown) => new Promise<any>((resolve) => messageHandler(message, {}, resolve));

  expect((await send({ type: 'LEARNING_SAVE', choice: 'word', item: { folder_id: 'f1', category: 'word', text: '你好', meaning: 'xin chào' } })).state).toBe('failed');
  fixed = true;
  const retried = await send({ type: 'LEARNING_SYNC_RETRY' });
  expect(retried.result).toMatchObject([{ state: 'completed' }]);
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
