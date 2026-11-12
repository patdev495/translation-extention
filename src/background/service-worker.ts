import { SettingsManager } from '../services/settings';
import { PDF_VIEWER_PATH, shouldUseExtensionPdfViewer } from './pdf-redirect';
import { TranslationCoordinator } from '../services/translation-coordinator';
import { TranslationEngine } from '../services/translation';
import { PhoneticEngine } from '../services/phonetics';
import { pinyin } from 'pinyin-pro';
import { getAccountLinkStatus, learningRequest, listSyncItems, openLearningLibrary, retryFailedItems, saveLearningItem, startAccountLink, unlinkAccount } from './learning-account-link';

// ─── PDF Redirect Logic ────────────────────────────────────────────────────

/**
 * Builds the redirect URL pointing to our PDF viewer.
 */
function buildViewerUrl(originalUrl: string): string {
  return chrome.runtime.getURL(`${PDF_VIEWER_PATH}?file=${encodeURIComponent(originalUrl)}`);
}

// Local PDFs have no HTTP response headers, so intercept them by URL.
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // main frame only

  const { url, tabId } = details;
  if (!shouldUseExtensionPdfViewer(url)) return;

  const { privacyConsentGranted } = await chrome.storage.local.get('privacyConsentGranted');
  if (privacyConsentGranted !== true) return;

  // Check if extension is active
  const res = await chrome.storage.local.get('active');
  const active = res.active !== undefined ? res.active : true;
  if (!active) return;

  const viewerUrl = buildViewerUrl(url);
  chrome.tabs.update(tabId, { url: viewerUrl });
});

// Wait for HTTP response headers so HTML preview pages ending in .pdf stay open.
// This also catches PDF responses without .pdf in the URL.
chrome.webRequest?.onHeadersReceived?.addListener(
  (details) => {
    if (details.frameId !== 0) return;
    if (details.type !== 'main_frame') return;

    // Skip if already our viewer
    if (details.url.startsWith(chrome.runtime.getURL(''))) return;

    const contentType = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type'
    );
    if (!shouldUseExtensionPdfViewer(details.url, contentType?.value)) return;

    // Use tabs API asynchronously (non-blocking)
    chrome.storage.local.get(['active', 'privacyConsentGranted']).then((res) => {
      if (res.privacyConsentGranted !== true) return;
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

// ─── Translation Helper ─────────────────────────────────────────────────────

async function translateText(text: string) {
  const { privacyConsentGranted } = await chrome.storage.local.get('privacyConsentGranted');
  if (privacyConsentGranted !== true) throw new Error('Open PolyTranslate settings and agree to data use before translating.');
  const settings = await SettingsManager.getSettings();
  return TranslationCoordinator.translate(text, settings);
}

// ─── Message Handlers ──────────────────────────────────────────────────────

const ocrJobs = new Map<string, { tabId: number; requestId: string }>();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FRAME_UI_VALIDATE_SOURCE') {
    if (sender.tab?.id === undefined || sender.frameId !== 0 || !Number.isInteger(message.source?.frameId)
      || message.source.frameId <= 0 || typeof message.source.documentId !== 'string') {
      sendResponse({ valid: false });
      return false;
    }
    chrome.webNavigation.getFrame({ tabId: sender.tab.id, frameId: message.source.frameId }).then(
      frame => sendResponse({ valid: !!frame && frame.documentId === message.source.documentId }),
      () => sendResponse({ valid: false }),
    );
    return true;
  }
  if (message.type === 'FRAME_UI_REQUEST') {
    if (sender.tab?.id === undefined || !sender.frameId || !['translate', 'dismiss', 'ocr'].includes(message.action)
      || (message.action === 'translate' && (typeof message.text !== 'string' || !message.text.trim() || message.text.length > 100000))) {
      sendResponse({ success: false, error: 'Invalid frame UI request' });
      return false;
    }
    chrome.tabs.sendMessage(sender.tab.id, {
      type: 'FRAME_UI_DELIVERY', action: message.action,
      ...(message.action === 'translate' ? { text: message.text, source: { frameId: sender.frameId, documentId: sender.documentId } } : {}),
    }, { frameId: 0 }).then(() => sendResponse({ success: true }),
      () => sendResponse({ success: false, error: 'Top document unavailable' }));
    return true;
  }
  if (message.type === 'TRANSLATE_SELECTION') {
    void (async () => {
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      const targetLang = message.targetLang;
      if (!text || text.length > 500 || !['vi', 'en', 'zh'].includes(targetLang)) throw new Error('Invalid selection translation request');
      const { privacyConsentGranted } = await chrome.storage.local.get('privacyConsentGranted');
      if (privacyConsentGranted !== true) throw new Error('Privacy consent required');
      const settings = await SettingsManager.getSettings();
      const translation = (await TranslationEngine.translateWithSettings(text, targetLang, settings)).translation.trim();
      const phonetics = targetLang === 'zh' ? pinyin(translation, { nonZh: 'consecutive' }).trim()
        : targetLang === 'en' ? await PhoneticEngine.getEnglishIPA(translation) : '';
      return { translation, phonetics: phonetics === translation ? '' : phonetics };
    })().then(
      result => sendResponse({ success: true, ...result }),
      (error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Translation unavailable' }),
    );
    return true;
  }
  if (message.type === 'LEARNING_SUGGEST_MEANING') {
    void (async () => {
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      if (!text) throw new Error('Chưa có chữ Trung để gợi ý nghĩa.');
      const { privacyConsentGranted } = await chrome.storage.local.get('privacyConsentGranted');
      if (privacyConsentGranted !== true) throw new Error('Cần cho phép dịch trong cài đặt extension.');
      const settings = await SettingsManager.getSettings();
      const result = await TranslationEngine.translateWithSettings(text, 'vi', settings);
      const meaning = result.translation.trim();
      if (!meaning || meaning === text) throw new Error('Không tìm được nghĩa gợi ý. Hãy nhập nghĩa trước khi lưu.');
      return meaning;
    })().then(
      meaning => sendResponse({ success: true, meaning }),
      (error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Không gợi ý được nghĩa.' }),
    );
    return true;
  }
  if (message.type === 'LEARNING_OPEN_LIBRARY') {
    void openLearningLibrary().then(() => sendResponse({ success: true }), () => sendResponse({ success: false }));
    return true;
  }
  if (message.type === 'LEARNING_FIND_SENTENCE') {
    const query = new URLSearchParams({ folder_id: message.folder_id, text: message.text });
    void learningRequest(`/items/existing?${query.toString()}`, { signal: AbortSignal.timeout(5000) }).then(
      (item) => sendResponse({ success: true, item }),
      (error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Không kiểm tra được câu đã lưu.' }),
    );
    return true;
  }
  if (message.type === 'LEARNING_SYNC_STATUS') {
    void listSyncItems().then(result => sendResponse({ success: true, result }), () => sendResponse({ success: false }));
    return true;
  }
  if (message.type === 'LEARNING_SYNC_RETRY') {
    void retryFailedItems().then(() => listSyncItems()).then(result => sendResponse({ success: true, result }), () => sendResponse({ success: false }));
    return true;
  }
  if (message.type === 'LEARNING_FOLDERS' || message.type === 'LEARNING_SAVE') {
    const task = message.type === 'LEARNING_FOLDERS'
      ? learningRequest('/folders')
      : saveLearningItem(message.choice, message.item);
    void task.then(
      (result) => sendResponse(message.type === 'LEARNING_SAVE' ? { success: true, state: (result as { state: string }).state, result } : { success: true, result }),
      (error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Không lưu được.' }),
    );
    return true;
  }
  if (message.type === 'START_ACCOUNT_LINK' || message.type === 'GET_ACCOUNT_LINK_STATUS' || message.type === 'UNLINK_ACCOUNT') {
    const task = message.type === 'START_ACCOUNT_LINK'
      ? startAccountLink()
      : message.type === 'UNLINK_ACCOUNT'
        ? unlinkAccount()
        : getAccountLinkStatus();
    void task.then(
      (status) => sendResponse({ success: true, status }),
      (error: unknown) => sendResponse({ success: false, error: error instanceof Error ? error.message : 'Account link failed' }),
    );
    return true;
  }

  if (message.type === 'TRANSLATE_HANZI_MEANING') {
    (async () => {
      const meaning = typeof message.meaning === 'string' ? message.meaning.trim() : '';
      if (!meaning) {
        sendResponse({ success: false, meaning: '' });
        return;
      }
      try {
        const { privacyConsentGranted } = await chrome.storage.local.get('privacyConsentGranted');
        if (privacyConsentGranted !== true) throw new Error('Privacy consent required');
        const cacheKey = `hanziMeaning:${meaning}`;
        const stored = await chrome.storage.local.get(cacheKey);
        const cached = stored[cacheKey] as string | undefined;
        if (cached) {
          sendResponse({ success: true, meaning: cached });
          return;
        }
        const settings = await SettingsManager.getSettings();
        const result = await TranslationEngine.translateWithSettings(meaning, 'vi', settings);
        const translated = result.translation.trim();
        if (!translated) throw new Error('Empty translated meaning');
        await chrome.storage.local.set({ [cacheKey]: translated });
        sendResponse({ success: true, meaning: translated });
      } catch {
        sendResponse({ success: false, meaning });
      }
    })();
    return true;
  }

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

  if (message.type === 'TRANSLATE_DIRECT_PRIMARY') {
    const { text } = message;

    (async () => {
      try {
        const { privacyConsentGranted } = await chrome.storage.local.get('privacyConsentGranted');
        if (privacyConsentGranted !== true) throw new Error('Privacy consent required');
        const settings = await SettingsManager.getSettings();
        const data = await TranslationCoordinator.translateDirectToPrimary(text, settings);
        sendResponse({ success: true, data });
      } catch (error: any) {
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  if (message.type === 'CAPTURE_TAB') {
    const { rect, viewport } = message;
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    const requestId = typeof message.requestId === 'string' ? message.requestId : '';
    const jobId = crypto.randomUUID();

    (async () => {
      try {
        if (tabId === undefined || windowId === undefined || sender.frameId !== 0 || !requestId) {
          throw new Error('OCR capture must originate from the top document');
        }
        if (!rect || !viewport || ![rect.x, rect.y, rect.width, rect.height, viewport.width, viewport.height].every(Number.isFinite)
          || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || viewport.width <= 0 || viewport.height <= 0
          || rect.x + rect.width > viewport.width + 1 || rect.y + rect.height > viewport.height + 1) {
          throw new Error('Invalid OCR Image Region');
        }
        const { privacyConsentGranted } = await chrome.storage.local.get('privacyConsentGranted');
        if (privacyConsentGranted !== true) throw new Error('Privacy consent required');
        if (!(await chrome.tabs.get(tabId)).active) throw new Error('The OCR tab is no longer active');
        // 1. Capture the screen viewport of the current active tab
        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        if (!(await chrome.tabs.get(tabId)).active) throw new Error('The OCR tab changed during capture');
        await chrome.tabs.sendMessage(tabId, { type: 'OCR_CAPTURED', requestId }, { frameId: 0 }).catch(() => {});

        // Crop screenshot in service worker first using OffscreenCanvas
        const croppedDataUrl = await cropScreenshot(dataUrl, rect, viewport);

        // 2. Ensure Offscreen Document is opened
        await ensureOffscreenDocument();
        resetOffscreenTimeout();
        ocrJobs.set(jobId, { tabId, requestId });

        // 3. Request OCR from the Offscreen Document on the pre-cropped image
        const settings = await SettingsManager.getSettings();
        const ocrResponse = await chrome.runtime.sendMessage({
          type: 'RUN_OCR',
          jobId,
          dataUrl: croppedDataUrl,
          rect: null,
          viewport: null,
          tier: settings.ocrModelTier ?? 'small',
          language: settings.ocrLanguage ?? 'ch',
        });

        if (!ocrResponse || !ocrResponse.success) {
          throw new Error(ocrResponse?.error || 'OCR failed in offscreen document.');
        }

        const text = ocrResponse.text;

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
      } finally {
        ocrJobs.delete(jobId);
      }
    })();

    return true; // Keep message channel open
  }

  if (message.type === 'OCR_PROGRESS') {
    const job = ocrJobs.get(message.jobId);
    if (job && sender.url === chrome.runtime.getURL('offscreen.html')) {
      void chrome.tabs.sendMessage(job.tabId, {
        type: 'OCR_PROGRESS', requestId: job.requestId, progress: message.progress,
      }, { frameId: 0 }).catch(() => {});
    }
    return false;
  }
});
