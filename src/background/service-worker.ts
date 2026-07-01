import { TranslationEngine } from '../services/translation';
import { SettingsManager } from '../services/settings';
import { PhoneticEngine } from '../services/phonetics';
import { PDF_VIEWER_PATH, shouldUseExtensionPdfViewer } from './pdf-redirect';
import { getDetectionTarget, getTranslationTargets } from '../services/translation-plan';

// ─── PDF Redirect Logic ────────────────────────────────────────────────────

/**
 * Builds the redirect URL pointing to our PDF viewer.
 */
function buildViewerUrl(originalUrl: string): string {
  return chrome.runtime.getURL(`${PDF_VIEWER_PATH}?file=${encodeURIComponent(originalUrl)}`);
}

// Intercept navigation to PDF URLs (by URL pattern)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only

  const { url, tabId } = details;
  if (!shouldUseExtensionPdfViewer(url)) return;

  // Check if extension is active
  const res = await chrome.storage.local.get('active');
  const active = res.active !== undefined ? res.active : true;
  if (!active) return;

  const viewerUrl = buildViewerUrl(url);
  chrome.tabs.update(tabId, { url: viewerUrl });
});

// Also intercept by Content-Type header for PDFs without .pdf in URL
// (e.g. Google Drive, server-side downloads)
chrome.webRequest?.onHeadersReceived?.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    if (details.type !== 'main_frame') return;

    // Skip if already our viewer
    if (details.url.startsWith(chrome.runtime.getURL(''))) return;

    const contentType = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type'
    );
    if (!contentType?.value?.includes('application/pdf')) return;

    // Use tabs API asynchronously (non-blocking)
    chrome.storage.local.get('active').then((res) => {
      const active = res.active !== undefined ? res.active : true;
      if (!active) return;
      const viewerUrl = buildViewerUrl(details.url);
      chrome.tabs.update(details.tabId, { url: viewerUrl });
    });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// ─── Message Handlers ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Open Chrome extension settings page so user can enable "Allow access to file URLs"
  if (message.type === 'OPEN_EXTENSION_SETTINGS') {
    chrome.tabs.create({
      url: `chrome://extensions/?id=${chrome.runtime.id}`,
    });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'TRANSLATE') {
    const { text } = message;

    (async () => {
      try {
        const settings = await SettingsManager.getSettings();

        // 1. Use the first enabled target to detect the source language. If all
        // targets are none, skip translation and show only the source block.
        const detectionTarget = getDetectionTarget(settings);
        const firstRes = detectionTarget
          ? await TranslationEngine.translateWithSettings(text, detectionTarget, settings)
          : null;
        const detectedLang = firstRes?.detectedLang ?? 'auto';

        // 2. Determine visible target languages, omitting disabled slots.
        const targetLangs = getTranslationTargets(settings, detectedLang);
        const translations = await Promise.all(
          targetLangs.map(async ({ lang }) => {
            const result = firstRes && lang === detectionTarget
              ? firstRes
              : await TranslationEngine.translateWithSettings(text, lang, settings);

            let phonetics = '';
            if (lang === 'en') {
              phonetics = PhoneticEngine.getEnglishIPA(result.translation);
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

        // 4. Generate Phonetics (IPA/Pinyin)
        let sourcePhonetics = '';
        const isSourceChinese = ['zh', 'zh-CN', 'zh-TW', 'zh-cn', 'zh-tw'].includes(detectedLang);
        const isSourceEnglish = detectedLang === 'en';

        if (isSourceEnglish) {
          sourcePhonetics = PhoneticEngine.getEnglishIPA(text);
        } else if (isSourceChinese) {
          sourcePhonetics = PhoneticEngine.getPinyin(text);
        }

        sendResponse({
          success: true,
          data: {
            detectedLang,
            sourcePhonetics,
            translations
          }
        });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open for async response
  }
});

