// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createTranslationContext, loadSettings, translateSelectedPageText } from '../src/content/translation-init';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('privacy consent', () => {
  test('page text cannot be translated before consent, even when the extension is active', async () => {
    let consent = false;
    const sendMessage = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (keys: string | string[]) => {
            if (keys === 'settings') return { settings: {} };
            return { active: true, privacyConsentGranted: consent };
          },
        },
      },
      runtime: { sendMessage },
    });

    const ctx = createTranslationContext();
    document.body.textContent = 'Text to translate';
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(document.body);
    selection.addRange(range);

    await loadSettings(ctx);
    expect(ctx.active).toBe(false);
    expect(translateSelectedPageText(ctx)).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();

    consent = true;
    await loadSettings(ctx);
    expect(ctx.active).toBe(true);
  });
});
