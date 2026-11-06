import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  test('should convert Chinese words to grouped Pinyin with tone marks', () => {
    const result = PhoneticEngine.getPinyin('\u6211\u559c\u6b22\u5b66\u4e60\u6c49\u8bed');
    expect(result).toBe('\u6211 w\u01d2 \u00b7 \u559c\u6b22 x\u01d0 huan \u00b7 \u5b66\u4e60 xu\u00e9 x\u00ed \u00b7 \u6c49\u8bed h\u00e0n y\u01d4');
  });

  test('should handle punctuation and English words in Chinese sentences gracefully', () => {
    const result = PhoneticEngine.getPinyin('Hello, \u6211\u559c\u6b22\u5b66\u4e60\u6c49\u8bed\uff01');
    expect(result).toBe('Hello, \u6211 w\u01d2 \u00b7 \u559c\u6b22 x\u01d0 huan \u00b7 \u5b66\u4e60 xu\u00e9 x\u00ed \u00b7 \u6c49\u8bed h\u00e0n y\u01d4\uff01');
  });
});

describe('PhoneticEngine - English IPA', () => {
  test('should convert English words to grouped IPA', async () => {
    const result = await PhoneticEngine.getEnglishIPA('hello');
    expect(result).toBe('hello h\u0259\u02c8\u026bo\u028a');
  });

  test('should convert full sentences preserving punctuation and casing', async () => {
    const result = await PhoneticEngine.getEnglishIPA('Hello, world!');
    expect(result).toBe('Hello h\u0259\u02c8\u026bo\u028a, \u00b7 world \u02c8w\u025d\u026bd!');
  });

  test('should degrade gracefully for unknown words', async () => {
    const result = await PhoneticEngine.getEnglishIPA('xyzabc');
    expect(result).toBe('xyzabc');
  });
});
