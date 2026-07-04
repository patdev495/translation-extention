export interface TranslationResult {
  translation: string;
  detectedLang: string;
}

export interface TranslationSettings {
  provider: 'google' | 'deepl';
  deeplApiKey: string;
}

export interface TranslationProvider {
  translate(text: string, targetLang: string): Promise<TranslationResult>;
}

export class GoogleTranslationProvider implements TranslationProvider {
  async translate(text: string, targetLang: string): Promise<TranslationResult> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Translate failed: ${response.statusText}`);
    }
    const data = await response.json();
    
    let translation = '';
    if (data && data[0]) {
      translation = data[0]
        .map((x: any) => x[0])
        .filter((x: any) => typeof x === 'string')
        .join('');
    }
    
    const detectedLang = data && data[2] ? data[2] : 'auto';
    return { translation, detectedLang };
  }
}

export class DeepLTranslationProvider implements TranslationProvider {
  constructor(private apiKey: string) {}

  async translate(text: string, targetLang: string): Promise<TranslationResult> {
    if (!this.apiKey) {
      throw new Error('DeepL API Key is missing. Please configure it in settings.');
    }

    const isFreeKey = this.apiKey.endsWith(':fx');
    const baseUrl = isFreeKey
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const mapLang = (lang: string) => {
      const l = lang.toLowerCase().split('-')[0];
      if (l === 'en') return 'EN-US';
      if (l === 'zh') return 'ZH';
      return l.toUpperCase();
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: mapLang(targetLang),
      }),
    });

    if (response.status === 403) {
      throw new Error('DeepL API Key is invalid or expired.');
    }

    if (!response.ok) {
      throw new Error(`DeepL translation failed. Status: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.translations && data.translations[0]) {
      const item = data.translations[0];
      return {
        translation: item.text,
        detectedLang: item.detected_source_language.toLowerCase(),
      };
    }

    throw new Error('DeepL translation returned empty result.');
  }
}

export class TranslationEngine {
  // Original translation method preserved for tests & compatibility
  static async translate(
    text: string,
    primaryTarget: string,
    secondaryTarget: string
  ): Promise<TranslationResult> {
    const google = new GoogleTranslationProvider();
    const result = await google.translate(text, primaryTarget);
    if (result.detectedLang === primaryTarget) {
      return await google.translate(text, secondaryTarget);
    }
    return result;
  }

  // Unified translation method using settings provider
  static async translateWithSettings(
    text: string,
    targetLang: string,
    settings: TranslationSettings
  ): Promise<TranslationResult> {
    let provider: TranslationProvider;
    if (settings.provider === 'deepl') {
      provider = new DeepLTranslationProvider(settings.deeplApiKey);
    } else {
      provider = new GoogleTranslationProvider();
    }
    return provider.translate(text, targetLang);
  }

  // Preserved static compatibility methods
  static async translateGoogle(text: string, targetLang: string): Promise<TranslationResult> {
    const google = new GoogleTranslationProvider();
    return google.translate(text, targetLang);
  }

  static async translateDeepL(text: string, targetLang: string, apiKey: string): Promise<TranslationResult> {
    const deepl = new DeepLTranslationProvider(apiKey);
    return deepl.translate(text, targetLang);
  }
}
