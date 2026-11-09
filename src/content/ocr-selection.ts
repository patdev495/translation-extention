import { TranslationContext, performTranslation, dismissTranslation } from './translation-init';
import { addPinnedSnippet } from './pinned-panel';
import { OcrSelectionOverlay } from './ocr-selection-overlay';
import { forwardFrameUi } from './frame-ui';
import { hideOverlaysForCapture } from './overlay-host';

let overlay: OcrSelectionOverlay | null = null;
let currentCtx: TranslationContext | null = null;
let ocrBusy = false;
let generation = 0;
let restoreCaptureUi: (() => void) | null = null;
let activeRequestId: string | null = null;

// Listen to progress updates relayed from the service worker
const chromeMessageListener = (message: any) => {
  if (message.requestId !== activeRequestId) return;
  if (message.type === 'OCR_CAPTURED') {
    restoreCaptureUi?.();
    restoreCaptureUi = null;
  }
  if (message.type === 'OCR_PROGRESS' && overlay) {
    overlay.updateProgressText(message.progress.message);
  }
};

export function isWebpageOcrActive(): boolean {
  return overlay !== null;
}

export function toggleWebpageOcr(ctx: TranslationContext): void {
  if (forwardFrameUi({ action: 'ocr' })) return;
  if (ocrBusy) return;

  if (overlay) {
    cleanupOverlay();
  } else {
    dismissTranslation(ctx);
    currentCtx = ctx;
    initOverlay();
  }
}

function initOverlay() {
  if (!currentCtx) return;
  const session = ++generation;
  // Content scripts on HTTP intranets cannot use secure-context-only randomUUID.
  const requestId = crypto.getRandomValues(new Uint32Array(4)).join('-');
  activeRequestId = requestId;

  currentCtx.tooltip.setPointerPassthrough(true);
  chrome.runtime.onMessage.addListener(chromeMessageListener);

  overlay = new OcrSelectionOverlay(document.body, {
    shadowMode: true,
    onSelectionComplete: async (rect) => {
      const left = rect.left;
      const top = rect.top;
      const width = rect.width;
      const height = rect.height;

      // Show progress indicator inside overlay shadow DOM
      overlay?.showProgress('Preparing OCR...', { left, top: top + height });

      ocrBusy = true;
      restoreCaptureUi = hideOverlaysForCapture();

      // Wait for browser repaint before capturing
      await new Promise((r) => setTimeout(r, 50));
      if (session !== generation) return;

      try {
        const response: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'CAPTURE_TAB',
              requestId,
              rect: {
                x: left,
                y: top,
                width: width,
                height: height,
                devicePixelRatio: rect.devicePixelRatio || window.devicePixelRatio
              },
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight
              }
            },
            (res) => resolve(res)
          );
        });

        if (session !== generation) return;
        restoreCaptureUi?.();
        restoreCaptureUi = null;
        if (response && response.success) {
          if (response.data && currentCtx) {
            const { text, croppedDataUrl } = response.data;
            // Document-relative coords for tooltip placement
            const docX = left + window.scrollX + width / 2;
            const docY = top + window.scrollY;

            if (text) {
              performTranslation(currentCtx, text, docX, docY, width);
            }

            if (currentCtx.settings?.ocrPinImage && croppedDataUrl) {
              addPinnedSnippet(croppedDataUrl, left, top, width, height);
            }

            if (currentCtx.settings?.ocrCopyToClipboard && croppedDataUrl) {
              copyImageToClipboard(croppedDataUrl).catch((err) => {
                console.error('Failed to copy image to clipboard:', err);
              });
            }

            if (!text) {
              overlay?.updateProgressText('No text found in this region.');
              await new Promise((r) => setTimeout(r, 2000));
            }
          } else {
            overlay?.updateProgressText('No text found in this region.');
            await new Promise((r) => setTimeout(r, 2000));
          }
        } else {
          console.error('OCR Error response:', response?.error);
          overlay?.updateProgressText(response?.error || 'OCR selection failed.');
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err: any) {
        if (session !== generation) return;
        restoreCaptureUi?.();
        restoreCaptureUi = null;
        console.error('OCR failed:', err);
        overlay?.updateProgressText(err.message || 'OCR selection failed.');
        await new Promise((r) => setTimeout(r, 2000));
      } finally {
        if (session === generation) cleanupOverlay();
      }
    },
    onCancel: () => {
      cleanupOverlay();
    }
  });

  overlay.start();
}

function cleanupOverlay() {
  generation++;
  activeRequestId = null;
  restoreCaptureUi?.();
  restoreCaptureUi = null;
  chrome.runtime.onMessage.removeListener(chromeMessageListener);
  currentCtx?.tooltip.setPointerPassthrough(false);

  if (overlay) {
    overlay.stop();
    overlay = null;
  }
  ocrBusy = false;
}

async function copyImageToClipboard(dataUrl: string): Promise<void> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const item = new ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([item]);
}
