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
      secondaryTargetLang: 'en',
      reverseTargetLang: 'zh',
      hotkey: 'none',
      ocrShortcut: 'ctrl-space',
      ocrModelTier: 'small',
      ocrLanguage: 'ch',
      ttsEnabled: true,
      provider: 'google',
      deeplApiKey: '',
      tooltipFontSize: '14',
      ocrPinImage: false,
      ocrCopyToClipboard: false,
    });
  });

  test('should update settings and retrieve updated values', async () => {
    const updated = await SettingsManager.updateSettings({
      primaryTargetLang: 'en',
      hotkey: 'ctrl',
      ocrShortcut: 'alt-o',
    });
    expect(updated.primaryTargetLang).toBe('en');
    expect(updated.hotkey).toBe('ctrl');
    expect(updated.ocrShortcut).toBe('alt-o');

    const retrieved = await SettingsManager.getSettings();
    expect(retrieved.primaryTargetLang).toBe('en');
    expect(retrieved.secondaryTargetLang).toBe('en');
    expect(retrieved.reverseTargetLang).toBe('zh');
    expect(retrieved.hotkey).toBe('ctrl');
    expect(retrieved.ocrShortcut).toBe('alt-o');
    expect(retrieved.provider).toBe('google');
    expect(retrieved.deeplApiKey).toBe('');
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
