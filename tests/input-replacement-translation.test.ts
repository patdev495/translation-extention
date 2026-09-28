import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TranslationCoordinator } from '../src/services/translation-coordinator';
import type { Settings } from '../src/services/settings';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const settings: Settings = {
  primaryTargetLang: 'vi',
  secondaryTargetLang: 'en',
  reverseTargetLang: 'zh',
  inputReplacementEnabled: true,
  inputReplacementShortcut: 'ControlLeft',
  ocrShortcut: 'ctrl-space',
  ocrModelTier: 'medium',
  ocrLanguage: 'latin',
  ttsEnabled: true,
  provider: 'google',
  deeplApiKey: '',
  tooltipFontSize: '16',
  ocrPinImage: false,
  ocrCopyToClipboard: false,
  autoTranslate: false,
  phoneticsVisible: true,
};

describe('Input Replacement Translation', () => {
  beforeEach(() => mockFetch.mockReset());

  test('translates directly to the Primary Target Language without fallback', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [[['Xin chào', 'Xin chào']], null, 'vi'],
    });

    await expect(TranslationCoordinator.translateDirectToPrimary('Xin chào', settings))
      .resolves.toEqual({ translation: 'Xin chào', detectedLang: 'vi' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('tl=vi');
  });

  test('rejects direct translation when Primary Target Language is disabled', async () => {
    await expect(TranslationCoordinator.translateDirectToPrimary('hello', {
      ...settings,
      primaryTargetLang: 'none',
    })).rejects.toThrow('Primary Target Language is disabled');
  });
});
