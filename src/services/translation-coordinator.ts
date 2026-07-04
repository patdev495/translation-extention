import { TranslationEngine } from './translation';
import { PhoneticEngine } from './phonetics';
import { getDetectionTarget, getTranslationTargets } from './translation-plan';
import type { Settings } from './settings';

export interface TranslationCoordinatorResult {
  detectedLang: string;
  sourcePhonetics: string;
  translations: {
    lang: string;
    text: string;
    phonetics: string;
  }[];
}

export function detectLanguageOffline(text: string): 'en' | 'vi' | 'zh' | null {
  const clean = text.trim();
  if (!clean) return null;

  // 1. Check Chinese characters (CJK Unified Ideographs)
  if (/[\u4e00-\u9fff]/.test(clean)) {
    return 'zh';
  }

  // 2. Check Vietnamese specific accented characters
  const viPattern = /[áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴĐ]/;
  if (viPattern.test(clean)) {
    return 'vi';
  }

  // 3. Check English (strictly standard characters, numbers, common punctuation, spaces)
  if (/^[a-zA-Z0-9\s.,;:?!'’"\-()\[\]{}]+$/.test(clean)) {
    return 'en';
  }

  return null;
}

export class TranslationCoordinator {
  static async translate(text: string, settings: Settings): Promise<TranslationCoordinatorResult> {
    let detectedLang: string;
    let firstRes = null;
    let targetLangs;

    const offlineLang = detectLanguageOffline(text);
    if (offlineLang) {
      detectedLang = offlineLang;
      targetLangs = getTranslationTargets(settings, detectedLang);
    } else {
      // Fallback: Use the first enabled target to detect the source language.
      const detectionTarget = getDetectionTarget(settings);
      firstRes = detectionTarget
        ? await TranslationEngine.translateWithSettings(text, detectionTarget, settings)
        : null;
      detectedLang = firstRes?.detectedLang ?? 'auto';
      targetLangs = getTranslationTargets(settings, detectedLang);
    }

    const translations = await Promise.all(
      targetLangs.map(async ({ lang }) => {
        const result = firstRes && lang === getDetectionTarget(settings)
          ? firstRes
          : await TranslationEngine.translateWithSettings(text, lang, settings);

        let phonetics = '';
        if (lang === 'en') {
          phonetics = await PhoneticEngine.getEnglishIPA(result.translation);
        } else if (lang === 'zh') {
          phonetics = PhoneticEngine.getPinyin(result.translation);
        }

        return {
          lang,
          text: result.translation,
          phonetics
        };
      })
    );

    // Generate Phonetics (IPA/Pinyin) for source text
    let sourcePhonetics = '';
    const isSourceChinese = ['zh', 'zh-CN', 'zh-TW', 'zh-cn', 'zh-tw'].includes(detectedLang);
    const isSourceEnglish = detectedLang === 'en';

    if (isSourceEnglish) {
      sourcePhonetics = await PhoneticEngine.getEnglishIPA(text);
    } else if (isSourceChinese) {
      sourcePhonetics = PhoneticEngine.getPinyin(text);
    }

    return {
      detectedLang,
      sourcePhonetics,
      translations
    };
  }
}
