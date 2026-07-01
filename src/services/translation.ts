export interface TranslationResult {
  translation: string;
  detectedLang: string;
}

export class TranslationEngine {
  static async translate(
    text: string,
    primaryTarget: string,
    secondaryTarget: string
  ): Promise<TranslationResult> {
    const runTranslation = async (target: string) => {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch translation: ${response.statusText}`);
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
    };

    const result = await runTranslation(primaryTarget);
    if (result.detectedLang === primaryTarget) {
      return await runTranslation(secondaryTarget);
    }
    return result;
  }
}
