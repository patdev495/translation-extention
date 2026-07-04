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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}

async function cropScreenshot(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number }
): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imgBitmap = await createImageBitmap(blob);

  const scaleX = imgBitmap.width / viewport.width;
  const scaleY = imgBitmap.height / viewport.height;
  const sx = rect.x * scaleX;
  const sy = rect.y * scaleY;
  const sw = rect.width * scaleX;
  const sh = rect.height * scaleY;

  const cropW = Math.max(1, Math.round(sw));
  const cropH = Math.max(1, Math.round(sh));

  const canvas = new OffscreenCanvas(cropW, cropH);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context for OffscreenCanvas');
  }

  ctx.drawImage(
    imgBitmap,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    cropW,
    cropH
  );

  imgBitmap.close();

  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const arrayBuffer = await croppedBlob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  return `data:image/png;base64,${base64}`;
}

function detectLanguageOffline(text: string): 'en' | 'vi' | 'zh' | null {
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

// ─── Translation Helper ─────────────────────────────────────────────────────

async function translateText(text: string) {
  const settings = await SettingsManager.getSettings();

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

  // 3. Generate Phonetics (IPA/Pinyin)
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

        // Crop screenshot in service worker first using OffscreenCanvas
        const croppedDataUrl = await cropScreenshot(dataUrl, rect, viewport);

        // 2. Ensure Offscreen Document is opened
        await ensureOffscreenDocument();
        resetOffscreenTimeout();

        // 3. Request OCR from the Offscreen Document on the pre-cropped image
        const settings = await SettingsManager.getSettings();
        const autoTranslate = settings.autoTranslate;
        const ocrResponse = await chrome.runtime.sendMessage({
          type: 'RUN_OCR',
          dataUrl: croppedDataUrl,
          rect: null,
          viewport: null,
          tier: settings.ocrModelTier ?? 'small',
          language: settings.ocrLanguage ?? 'ch',
          skipOcr: !autoTranslate
        });

        if (!ocrResponse || !ocrResponse.success) {
          throw new Error(ocrResponse?.error || 'OCR failed in offscreen document.');
        }

        const text = ocrResponse.text;

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
