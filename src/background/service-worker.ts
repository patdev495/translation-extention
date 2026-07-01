import { TranslationEngine } from '../services/translation';
import { SettingsManager } from '../services/settings';
import { PhoneticEngine } from '../services/phonetics';

// ─── PDF Redirect Logic ────────────────────────────────────────────────────

const PDF_VIEWER_PATH = 'pdf-viewer/viewer.html';

/**
 * Returns true if the URL looks like a PDF by its path/query.
 */
function isPdfUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Ignore the viewer itself to avoid redirect loops
    if (u.protocol === 'chrome-extension:') return false;
    return /\.pdf(\?.*)?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

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
  if (!isPdfUrl(url)) return;

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

