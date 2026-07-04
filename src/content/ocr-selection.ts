import { TranslationContext, performTranslation } from './translation-init';
import { addPinnedSnippet } from './pinned-panel';
import { OcrSelectionOverlay } from './ocr-selection-overlay';

let overlay: OcrSelectionOverlay | null = null;
let currentCtx: TranslationContext | null = null;
let ocrBusy = false;

// Listen to progress updates relayed from the service worker
const chromeMessageListener = (message: any) => {
  if (message.type === 'OCR_PROGRESS' && overlay) {
    overlay.updateProgressText(message.progress.message);
  }
};

export function isWebpageOcrActive(): boolean {
  return overlay !== null;
}

export function toggleWebpageOcr(ctx: TranslationContext): void {
  if (ocrBusy) return;

  if (overlay) {
    cleanupOverlay();
  } else {
    currentCtx = ctx;
    initOverlay();
  }
}

function initOverlay() {
  if (!currentCtx) return;

  chrome.runtime.onMessage.addListener(chromeMessageListener);

  overlay = new OcrSelectionOverlay(document.body, {
    shadowMode: true,
    onSelectionComplete: async (rect) => {
      const left = rect.left;
      const top = rect.top;
      const width = rect.width;
      const height = rect.height;

      // Show progress indicator inside overlay shadow DOM
      if (currentCtx?.settings?.autoTranslate) {
        overlay?.showProgress('Preparing OCR...', { left, top: top + height });
      } else if (currentCtx?.settings?.ocrPinImage) {
        overlay?.showProgress('Pinning image...', { left, top: top + height });
      } else {
        overlay?.showProgress('Copying image...', { left, top: top + height });
      }

      ocrBusy = true;

      // Wait for browser repaint before capturing
      await new Promise((r) => setTimeout(r, 50));

      try {
        const response: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'CAPTURE_TAB',
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

        if (response && response.success) {
          if (response.data && currentCtx) {
            const { text, croppedDataUrl } = response.data;
            // Document-relative coords for tooltip placement
            const docX = left + window.scrollX + width / 2;
            const docY = top + window.scrollY;

            if (currentCtx.settings?.autoTranslate && text) {
              performTranslation(currentCtx, text, docX, docY);
            }

            if (currentCtx.settings?.ocrPinImage && croppedDataUrl) {
              addPinnedSnippet(croppedDataUrl, left, top, width, height);
            }

            if (currentCtx.settings?.ocrCopyToClipboard && croppedDataUrl) {
              copyImageToClipboard(croppedDataUrl).catch((err) => {
                console.error('Failed to copy image to clipboard:', err);
              });
            }

            if (!currentCtx.settings?.autoTranslate) {
              cleanupOverlay();
              return;
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
        console.error('OCR failed:', err);
        overlay?.updateProgressText(err.message || 'OCR selection failed.');
        await new Promise((r) => setTimeout(r, 2000));
      } finally {
        cleanupOverlay();
      }
    },
    onCancel: () => {
      cleanupOverlay();
    }
  });

  overlay.start();
}

function cleanupOverlay() {
  chrome.runtime.onMessage.removeListener(chromeMessageListener);

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
