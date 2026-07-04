import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock chrome.runtime.getURL and fetch to return the local cmu-dict.json contents in test environment
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

import { PhoneticEngine } from '../src/services/phonetics';

describe('PhoneticEngine - Chinese Pinyin', () => {
  test('should convert Chinese characters to Pinyin with tone marks', () => {
    const result = PhoneticEngine.getPinyin('我喜欢学习汉语');
    expect(result).toBe('wǒ xǐ huan xué xí hàn yǔ');
  });

  test('should handle punctuation and English words in Chinese sentences gracefully', () => {
    const result = PhoneticEngine.getPinyin('Hello, 我喜欢学习汉语！');
    // Non-chinese parts and punctuation should be preserved.
    // pinyin-pro usually preserves non-Chinese when called with the right options or we can handle it.
    expect(result).toBe('Hello, wǒ xǐ huan xué xí hàn yǔ！');
  });
});

describe('PhoneticEngine - English IPA', () => {
  test('should convert English words to IPA', async () => {
    const result = await PhoneticEngine.getEnglishIPA('hello');
    expect(result).toBe('həˈɫoʊ');
  });

  test('should convert full sentences preserving punctuation and casing', async () => {
    const result = await PhoneticEngine.getEnglishIPA('Hello, world!');
    expect(result).toBe('həˈɫoʊ, ˈwɝɫd!');
  });

  test('should degrade gracefully for unknown words', async () => {
    const result = await PhoneticEngine.getEnglishIPA('xyzabc');
    expect(result).toBe('xyzabc');
  });
});

