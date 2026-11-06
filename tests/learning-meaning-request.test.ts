import { expect, test, vi } from 'vitest';

test('Meaning Suggestion translates exact Chinese item to Vietnamese even with Chinese Primary Target Language', async () => {
  vi.resetModules();
  let listener: (message: { type: string; text: string }, sender: unknown, respond: (value: unknown) => void) => void = () => {};
  vi.stubGlobal('chrome', {
    webNavigation: { onBeforeNavigate: { addListener: vi.fn() } },
    runtime: { onMessage: { addListener: (handler: typeof listener) => { listener = handler; } }, getURL: (path: string) => path },
    storage: { local: {
      get: vi.fn(async (key: string) => ({ [key]: key === 'privacyConsentGranted' ? true : { primaryTargetLang: 'zh', provider: 'google' } })),
      set: vi.fn(async () => {}),
    } },
  });
  const fetcher = vi.fn(async (_url: string) => ({ ok: true, json: async () => [[['hãy để chúng ta', '让我们']], null, 'zh'] }));
  vi.stubGlobal('fetch', fetcher);
  await import('../src/background/service-worker');
  const response = await new Promise<unknown>(resolve => listener({ type: 'LEARNING_SUGGEST_MEANING', text: '让我们' }, {}, resolve));
  expect(response).toEqual({ success: true, meaning: 'hãy để chúng ta' });
  expect(String(fetcher.mock.calls[0]?.[0])).toContain('tl=vi');
});
