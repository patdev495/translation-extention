import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SettingsManager } from '../src/services/settings';

let mockStorage: Record<string, any> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | Record<string, any> | null) => {
        if (typeof keys === 'string') {
          return { [keys]: mockStorage[keys] };
        } else if (Array.isArray(keys)) {
          const res: Record<string, any> = {};
          keys.forEach(k => { res[k] = mockStorage[k]; });
          return res;
        } else if (keys && typeof keys === 'object') {
          const res: Record<string, any> = {};
          Object.keys(keys).forEach(k => {
            res[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k];
          });
          return res;
        }
        return mockStorage;
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.entries(items).forEach(([k, v]) => {
          mockStorage[k] = v;
        });
      }),
    }
  }
} as any;

describe('SettingsManager', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  test('should return default settings when storage is empty', async () => {
    const settings = await SettingsManager.getSettings();
    expect(settings).toEqual({
      primaryTargetLang: 'vi',
      secondaryTargetLang: 'zh',
      reverseTargetLang: 'en',
      ocrShortcut: 'ctrl-space',
      ocrModelTier: 'medium',
      ocrLanguage: 'ch',
      ttsEnabled: true,
      provider: 'google',
      deeplApiKey: '',
      tooltipFontSize: '16',
      ocrPinImage: false,
      ocrCopyToClipboard: true,
      autoTranslate: true,
    });
  });

  test('should update settings and retrieve updated values', async () => {
    const updated = await SettingsManager.updateSettings({
      primaryTargetLang: 'en',
      ocrShortcut: 'alt-o',
      autoTranslate: false,
    });
    expect(updated.primaryTargetLang).toBe('en');
    expect(updated.ocrShortcut).toBe('alt-o');
    expect(updated.autoTranslate).toBe(false);

    const retrieved = await SettingsManager.getSettings();
    expect(retrieved.primaryTargetLang).toBe('en');
    expect(retrieved.secondaryTargetLang).toBe('zh');
    expect(retrieved.reverseTargetLang).toBe('en');
    expect(retrieved.ocrShortcut).toBe('alt-o');
    expect(retrieved.provider).toBe('google');
    expect(retrieved.deeplApiKey).toBe('');
    expect(retrieved.autoTranslate).toBe(false);
  });

  test('should allow disabling individual translation targets', async () => {
    const updated = await SettingsManager.updateSettings({
      primaryTargetLang: 'none',
      secondaryTargetLang: 'none',
      reverseTargetLang: 'none',
    });

    expect(updated.primaryTargetLang).toBe('none');
    expect(updated.secondaryTargetLang).toBe('none');
    expect(updated.reverseTargetLang).toBe('none');
  });
});
