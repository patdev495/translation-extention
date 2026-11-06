import { describe, expect, test, vi } from 'vitest';

describe('Hanzi component meaning request', () => {
  test('the background translates an English component meaning to Vietnamese', async () => {
    let listener: (message: { type: string; meaning: string }, sender: unknown, respond: (value: unknown) => void) => void = () => {};
    const storage: Record<string, unknown> = { privacyConsentGranted: true };
    vi.stubGlobal('chrome', {
      webNavigation: { onBeforeNavigate: { addListener: vi.fn() } },
      runtime: {
        onMessage: { addListener: (handler: typeof listener) => { listener = handler; } },
        getURL: (path: string) => path,
      },
      storage: { local: {
        get: vi.fn(async (key: string) => ({ [key]: structuredClone(storage[key]) })),
        set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(storage, structuredClone(value)); }),
      } },
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [[['ngựa', 'horse']], null, 'en'] })));
    await import('../src/background/service-worker');
    const response = vi.fn();
    listener({ type: 'TRANSLATE_HANZI_MEANING', meaning: 'horse' }, {}, response);

    await vi.waitFor(() => expect(response).toHaveBeenCalledWith({ success: true, meaning: 'ngựa' }));

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const cachedResponse = vi.fn();
    listener({ type: 'TRANSLATE_HANZI_MEANING', meaning: 'horse' }, {}, cachedResponse);
    await vi.waitFor(() => expect(cachedResponse).toHaveBeenCalledWith({ success: true, meaning: 'ngựa' }));

    const request = (meaning: string) => new Promise<unknown>(resolve => {
      listener({ type: 'TRANSLATE_HANZI_MEANING', meaning }, {}, resolve);
    });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const translated = url.includes('woman') ? 'phụ nữ' : 'cây';
      return { ok: true, json: async () => [[[translated, 'source']], null, 'en'] };
    }));
    await Promise.all([request('woman'), request('tree')]);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await Promise.all([request('woman'), request('tree')])).toEqual([
      { success: true, meaning: 'phụ nữ' }, { success: true, meaning: 'cây' },
    ]);
  });
});
