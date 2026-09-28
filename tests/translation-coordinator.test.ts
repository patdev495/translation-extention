import { describe, test, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock chrome.runtime.getURL and fetch for local cmu-dict.json loading in tests
global.chrome = {
  runtime: {
    getURL: (path: string) => path,
  },
} as any;

global.fetch = async (url: any) => {
  if (url === 'cmu-dict.json') {
    const data = readFileSync(resolve(__dirname, '../public/cmu-dict.json'), 'utf-8');
    return {
      json: async () => JSON.parse(data),
    } as any;
  }
  throw new Error(`Mock fetch received unexpected URL: ${url}`);
};

import { TranslationCoordinator, detectLanguageOffline } from '../src/services/translation-coordinator';
import { TranslationEngine } from '../src/services/translation';
import type { Settings } from '../src/services/settings';

const mockSettings: Settings = {
  primaryTargetLang: 'vi',
  secondaryTargetLang: 'zh',
  reverseTargetLang: 'en',
  inputReplacementEnabled: true,
  inputReplacementShortcut: 'ControlLeft',
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
  phoneticsVisible: true,
};

describe('detectLanguageOffline', () => {
  test('should detect Chinese characters', () => {
    expect(detectLanguageOffline('你好')).toBe('zh');
    expect(detectLanguageOffline('我喜欢学习汉语')).toBe('zh');
  });

  test('should detect Vietnamese accented characters', () => {
    expect(detectLanguageOffline('Xin chào quý khách')).toBe('vi');
    expect(detectLanguageOffline('Tiếng Việt')).toBe('vi');
  });

  test('should detect English characters', () => {
    expect(detectLanguageOffline('Hello world!')).toBe('en');
    expect(detectLanguageOffline('This is a test.')).toBe('en');
  });

  test('should prioritize Vietnamese over Chinese and English', () => {
    // Contains both Vietnamese and Chinese: should be detected as Vietnamese
    expect(detectLanguageOffline('Tiếng Việt 你好')).toBe('vi');
    // Contains both Vietnamese and English: should be detected as Vietnamese
    expect(detectLanguageOffline('Hello Tiếng Việt')).toBe('vi');
  });

  test('should prioritize Chinese over English', () => {
    // Contains both Chinese and English: should be detected as Chinese
    expect(detectLanguageOffline('Hello 你好')).toBe('zh');
  });

  test('should return null for mixed/unknown characters or numbers only', () => {
    expect(detectLanguageOffline('12345')).toBe('en'); // Matches regex
    expect(detectLanguageOffline('   ')).toBeNull();
  });
});

describe('TranslationCoordinator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should translate English and map source phonetics (IPA) and target phonetics (Pinyin)', async () => {
    const translateSpy = vi.spyOn(TranslationEngine, 'translateWithSettings')
      .mockImplementation(async (text, targetLang) => {
        if (targetLang === 'vi') {
          return { translation: 'Xin chào', detectedLang: 'en' };
        } else if (targetLang === 'zh') {
          return { translation: '你好', detectedLang: 'en' };
        }
        return { translation: text, detectedLang: 'en' };
      });

    const result = await TranslationCoordinator.translate('hello', mockSettings);

    expect(result.detectedLang).toBe('en');
    // hello -> hello həˈɫoʊ
    expect(result.sourcePhonetics).toBe('hello həˈɫoʊ');
    expect(result.translations).toEqual([
      { lang: 'vi', text: 'Xin chào', phonetics: '' },
      { lang: 'zh', text: '你好', phonetics: '你好 nǐ hǎo' },
    ]);

    expect(translateSpy).toHaveBeenCalledTimes(2);
  });

  test('should fallback to translateWithSettings for detection when offline check yields null', async () => {
    // Non-matching character string like symbols/non-latin
    const queryText = '???';

    const translateSpy = vi.spyOn(TranslationEngine, 'translateWithSettings')
      .mockImplementation(async (text, targetLang) => {
        return { translation: 'Kết quả', detectedLang: 'en' };
      });

    const result = await TranslationCoordinator.translate(queryText, mockSettings);

    expect(result.detectedLang).toBe('en');
    expect(translateSpy).toHaveBeenCalled();
  });

  test('preserves OCR line shape when translation provider flattens newlines', async () => {
    vi.spyOn(TranslationEngine, 'translateWithSettings')
      .mockResolvedValue({
        translation: 'One two three four five six seven eight nine ten eleven twelve',
        detectedLang: 'en',
      });

    const result = await TranslationCoordinator.translate(
      'source line one\nsource line two is longer\nsource line three\nlast',
      { ...mockSettings, secondaryTargetLang: 'disabled' as any }
    );

    expect(result.translations[0].text.split('\n')).toHaveLength(4);
    expect(result.translations[0].text).toBe(
      'One two three four\nfive six seven eight nine\nten eleven\ntwelve'
    );
  });
});
