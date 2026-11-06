// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

describe('Hanzi stroke speed setting in the popup', () => {
  test('a user can change and persist the drawing speed', async () => {
    const html = readFileSync(resolve(__dirname, '../popup/index.html'), 'utf8');
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    const storage: Record<string, any> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
          set: vi.fn(async (value: Record<string, any>) => { Object.assign(storage, value); }),
        },
        onChanged: { addListener: vi.fn() },
      },
      tabs: { query: vi.fn((_query, callback) => callback([])) },
      runtime: { sendMessage: vi.fn(async () => undefined) },
    });

    await import('../popup/popup');
    const speed = document.getElementById('hanzi-stroke-speed') as HTMLSelectElement | null;
    expect(speed?.value).toBe('2');

    speed!.value = '0.5';
    speed!.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(storage.settings?.hanziStrokeSpeed).toBe(0.5));
  });
});
