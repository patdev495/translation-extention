import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function response(body: unknown, status = 200): MockResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('extension account link', () => {
  const publicStorage = new Map<string, unknown>();
  const openedTabs: string[] = [];
  const alarms = new Set<string>();

  beforeEach(() => {
    vi.resetModules();
    publicStorage.clear();
    openedTabs.length = 0;
    alarms.clear();
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubGlobal('__LEARNING_API_BASE__', 'http://127.0.0.1:8000');
    vi.stubGlobal('chrome', {
      storage: { local: {
        set: async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) publicStorage.set(key, value);
        },
        get: async (key: string) => ({ [key]: publicStorage.get(key) }),
      } },
      alarms: {
        create: async (name: string) => { alarms.add(name); },
        clear: async (name: string) => { alarms.delete(name); },
        onAlarm: { addListener: vi.fn() },
      },
      tabs: { create: async ({ url }: { url: string }) => { openedTabs.push(url); } },
      runtime: { onStartup: { addListener: vi.fn() } },
    });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('stores token privately, shows only status, and revokes on unlink', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/link/start')) {
        return response({
          request_id: 'request-1', poll_secret: 'private-secret',
          approve_url: 'http://127.0.0.1:5173/?link=request-1', expires_at: expiresAt,
        });
      }
      if (url.endsWith('/api/link/poll')) {
        return response({ state: 'linked', token: 'private-access-token', account: { id: 'user-1', username: 'learner' } });
      }
      if (url.endsWith('/api/extension/me')) {
        return response({ id: 'user-1', username: 'learner' });
      }
      if (url.endsWith('/api/extension/revoke')) return response(null, 204);
      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const link = await import('../src/background/learning-account-link');

    expect((await link.startAccountLink()).state).toBe('pending');
    expect(openedTabs).toEqual(['http://127.0.0.1:5173/?link=request-1']);
    expect(alarms.size).toBe(1);
    await link.pollAccountLink();
    expect(await link.getAccountLinkStatus()).toEqual({ state: 'linked', username: 'learner' });
    expect(JSON.stringify([...publicStorage.entries()])).not.toContain('private-access-token');
    expect(JSON.stringify([...publicStorage.entries()])).not.toContain('private-secret');
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/api/extension/revoke'))).toBe(false);
    expect((await link.unlinkAccount()).state).toBe('unlinked');
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/api/extension/revoke'))).toBe(true);
    expect(alarms.size).toBe(0);
  });

  it('does not keep an expired device request', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/link/start')) {
        return response({ request_id: 'expired', poll_secret: 'private', approve_url: 'http://127.0.0.1:5173/?link=expired', expires_at: 1 });
      }
      throw new Error(`Unexpected request ${url}`);
    }));
    const link = await import('../src/background/learning-account-link');
    await link.startAccountLink();
    await link.pollAccountLink();
    expect(publicStorage.get('learningAccountStatus')).toEqual({ state: 'error', message: 'Yêu cầu liên kết hết hạn. Hãy thử lại.' });
    expect(alarms.size).toBe(0);
  });
});
