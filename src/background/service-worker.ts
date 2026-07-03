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

// ─── Offscreen Document Lifecycle Management ────────────────────────────────

let creatingOffscreen: Promise<void> | null = null;
let offscreenTimeout: any = null;

function resetOffscreenTimeout() {
  if (offscreenTimeout) {
    clearTimeout(offscreenTimeout);
  }
  offscreenTimeout = setTimeout(() => {
    chrome.offscreen.closeDocument().catch(() => {});
  }, 45000); // Close after 45 seconds of inactivity
}

async function ensureOffscreenDocument(): Promise<void> {
  const url = chrome.runtime.getURL('offscreen.html');
  const clients = await (self as any).clients.matchAll();
  for (const client of clients) {
    if (client.url === url) {
      return;
    }
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER' as any],
    justification: 'Run local OCR model on cropped webpage screenshot',
  });
  await creatingOffscreen;
  creatingOffscreen = null;
}

// ─── Translation Helper ─────────────────────────────────────────────────────

async function translateText(text: string) {
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

  // 3. Generate Phonetics (IPA/Pinyin)
  let sourcePhonetics = '';
  const isSourceChinese = ['zh', 'zh-CN', 'zh-TW', 'zh-cn', 'zh-tw'].includes(detectedLang);
  const isSourceEnglish = detectedLang === 'en';

  if (isSourceEnglish) {
    sourcePhonetics = PhoneticEngine.getEnglishIPA(text);
  } else if (isSourceChinese) {
    sourcePhonetics = PhoneticEngine.getPinyin(text);
  }

  return {
    detectedLang,
    sourcePhonetics,
    translations
  };
}

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
        const data = await translateText(text);
        sendResponse({ success: true, data });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open for async response
  }

  if (message.type === 'CAPTURE_TAB') {
    const { rect, viewport } = message;

    (async () => {
      try {
        // 1. Capture the screen viewport of the current active tab
        const dataUrl = await chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: 'png' });

        // 2. Ensure Offscreen Document is opened
        await ensureOffscreenDocument();
        resetOffscreenTimeout();

        // 3. Request OCR/cropping from the Offscreen Document
        const settings = await SettingsManager.getSettings();
        const autoTranslate = settings.autoTranslate;
        const ocrResponse = await chrome.runtime.sendMessage({
          type: 'RUN_OCR',
          dataUrl,
          rect,
          viewport,
          tier: settings.ocrModelTier ?? 'small',
          language: settings.ocrLanguage ?? 'ch',
          skipOcr: !autoTranslate
        });

        if (!ocrResponse || !ocrResponse.success) {
          throw new Error(ocrResponse?.error || 'OCR failed in offscreen document.');
        }

        const text = ocrResponse.text;
        const croppedDataUrl = ocrResponse.croppedDataUrl;

        if (!autoTranslate) {
          sendResponse({
            success: true,
            data: {
              text: '',
              croppedDataUrl
            }
          });
          return;
        }

        if (!text) {
          sendResponse({ success: true, data: null });
          return;
        }

        // 4. Translate the OCR result
        const data = await translateText(text);

        sendResponse({
          success: true,
          data: {
            text,
            croppedDataUrl,
            ...data
          }
        });
      } catch (error: any) {
        console.error('Service worker CAPTURE_TAB error:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open
  }

  if (message.type === 'OCR_PROGRESS') {
    // Relay OCR progress message from offscreen document to active tab content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, {
          type: 'OCR_PROGRESS',
          progress: message.progress
        }).catch(() => {
          // Ignore
        });
      }
    });
    return false;
  }
});
