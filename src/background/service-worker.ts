import { TranslationEngine } from '../services/translation';
import { SettingsManager } from '../services/settings';
import { PhoneticEngine } from '../services/phonetics';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATE') {
    const { text } = message;
    
    (async () => {
      try {
        const settings = await SettingsManager.getSettings();
        
        // 1. First translation to detect source language using configured provider
        const firstRes = await TranslationEngine.translateWithSettings(
          text,
          settings.primaryTargetLang,
          settings
        );
        const detectedLang = firstRes.detectedLang;

        // 2. Determine dual target languages using the reverse logic
        let targetLang1 = settings.primaryTargetLang;
        let targetLang2 = settings.secondaryTargetLang;

        if (detectedLang === settings.primaryTargetLang) {
          targetLang1 = settings.reverseTargetLang;
          targetLang2 = settings.secondaryTargetLang;
        } else if (detectedLang === settings.secondaryTargetLang) {
          targetLang1 = settings.primaryTargetLang;
          targetLang2 = settings.reverseTargetLang;
        }

        // 3. Perform dual translations (optimizing to reuse firstRes if possible)
        let translation1 = '';
        let translation2 = '';
        const promises: Promise<any>[] = [];

        if (targetLang1 === settings.primaryTargetLang) {
          translation1 = firstRes.translation;
        } else {
          promises.push(
            TranslationEngine.translateWithSettings(text, targetLang1, settings)
              .then(r => { translation1 = r.translation; })
          );
        }

        if (targetLang2 === settings.primaryTargetLang) {
          translation2 = firstRes.translation;
        } else {
          promises.push(
            TranslationEngine.translateWithSettings(text, targetLang2, settings)
              .then(r => { translation2 = r.translation; })
          );
        }

        await Promise.all(promises);

        // 4. Generate Phonetics (IPA/Pinyin)
        let sourcePhonetics = '';
        const isSourceChinese = ['zh', 'zh-CN', 'zh-TW', 'zh-cn', 'zh-tw'].includes(detectedLang);
        const isSourceEnglish = detectedLang === 'en';

        if (isSourceEnglish) {
          sourcePhonetics = PhoneticEngine.getEnglishIPA(text);
        } else if (isSourceChinese) {
          sourcePhonetics = PhoneticEngine.getPinyin(text);
        }

        let phonetics1 = '';
        if (targetLang1 === 'en') {
          phonetics1 = PhoneticEngine.getEnglishIPA(translation1);
        } else if (targetLang1 === 'zh') {
          phonetics1 = PhoneticEngine.getPinyin(translation1);
        }

        let phonetics2 = '';
        if (targetLang2 === 'en') {
          phonetics2 = PhoneticEngine.getEnglishIPA(translation2);
        } else if (targetLang2 === 'zh') {
          phonetics2 = PhoneticEngine.getPinyin(translation2);
        }

        sendResponse({
          success: true,
          data: {
            detectedLang,
            sourcePhonetics,
            translation1: {
              lang: targetLang1,
              text: translation1,
              phonetics: phonetics1
            },
            translation2: {
              lang: targetLang2,
              text: translation2,
              phonetics: phonetics2
            }
          }
        });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open for async response
  }
});
