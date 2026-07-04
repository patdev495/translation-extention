import { pinyin } from 'pinyin-pro';

let cmuDictCache: Record<string, string> | null = null;

async function getCmuDict(): Promise<Record<string, string>> {
  if (cmuDictCache) return cmuDictCache;

  try {
    const url = chrome.runtime.getURL('cmu-dict.json');
    const response = await fetch(url);
    cmuDictCache = await response.json();
  } catch (err) {
    console.error('Failed to load CMU dictionary:', err);
  }

  return cmuDictCache || {};
}

export class PhoneticEngine {
  static getPinyin(text: string): string {
    const rawPinyin = pinyin(text, { nonZh: 'consecutive' });
    const cleanSpaces = rawPinyin.replace(/\s+/g, ' ').trim();
    // Remove space before common full-width and half-width punctuation marks
    return cleanSpaces.replace(/\s([。，、；：？！…“”‘’（）[\]{}.,;:?!])/g, '$1');
  }

  static async getEnglishIPA(text: string): Promise<string> {
    const cmuDict = await getCmuDict();
    const tokens = text.split(/([a-zA-Z'-]+)/);
    const mapped = tokens.map(token => {
      if (/^[a-zA-Z'-]+$/.test(token)) {
        const lower = token.toLowerCase();
        if (lower in cmuDict) {
          return cmuDict[lower];
        }
        return token;
      }
      return token;
    });
    return mapped.join('');
  }
}
