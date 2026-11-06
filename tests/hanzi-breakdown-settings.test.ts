// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { SettingsManager } from '../src/services/settings';

describe('Hanzi Component Breakdown settings', () => {
  test('the breakdown is off by default and its language is Vietnamese', async () => {
    const html = readFileSync(resolve(__dirname, '../popup/index.html'), 'utf8');
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    const storage: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
          set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(storage, value); }),
        },
        onChanged: { addListener: vi.fn() },
      },
      tabs: { query: vi.fn((_query, callback) => callback([])) },
      runtime: { sendMessage: vi.fn(async () => undefined) },
    });

    await import('../popup/popup');
    const settings = await SettingsManager.getSettings();
    expect({
      enabled: settings.hanziBreakdownEnabled,
      language: settings.hanziBreakdownLanguage,
      toggle: (document.getElementById('hanzi-breakdown-enabled') as HTMLInputElement | null)?.checked,
      select: (document.getElementById('hanzi-breakdown-language') as HTMLSelectElement | null)?.value,
    }).toEqual({ enabled: false, language: 'vi', toggle: false, select: 'vi' });

    const toggle = document.getElementById('hanzi-breakdown-enabled') as HTMLInputElement;
    const language = document.getElementById('hanzi-breakdown-language') as HTMLSelectElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(async () => expect((await SettingsManager.getSettings()).hanziBreakdownEnabled).toBe(true));
    language.value = 'en';
    language.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(async () => {
      const saved = await SettingsManager.getSettings();
      expect({ enabled: saved.hanziBreakdownEnabled, language: saved.hanziBreakdownLanguage })
        .toEqual({ enabled: true, language: 'en' });
    });
  });
});
