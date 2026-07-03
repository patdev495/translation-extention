import { recognizeImageRegion } from '../services/ocr';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RUN_OCR') {
    const { dataUrl, rect, viewport, tier, language, skipOcr } = message;

    (async () => {
      try {
        const result = await processOcr(dataUrl, rect, viewport, tier, language, skipOcr);
        sendResponse({ success: true, text: result.text, croppedDataUrl: result.croppedDataUrl });
      } catch (err: any) {
        console.error('OCR Error in offscreen document:', err);
        sendResponse({ success: false, error: err?.message || String(err) });
      }
    })();

    return true; // Keep message channel open for async response
  }
});

async function processOcr(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number; devicePixelRatio?: number },
  viewport?: { width: number; height: number },
  tier: 'tiny' | 'small' | 'medium' = 'small',
  language: 'ch' | 'latin' = 'ch',
  skipOcr = false
): Promise<{ text: string; croppedDataUrl: string }> {
  return new Promise<{ text: string; croppedDataUrl: string }>((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        let scaleX = rect.devicePixelRatio || 1;
        let scaleY = rect.devicePixelRatio || 1;
        if (viewport && viewport.width && viewport.height) {
          scaleX = img.width / viewport.width;
          scaleY = img.height / viewport.height;
        }

        const sx = rect.x * scaleX;
        const sy = rect.y * scaleY;
        const sw = rect.width * scaleX;
        const sh = rect.height * scaleY;

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          throw new Error('Failed to get 2D context for offscreen canvas');
        }

        // Draw cropped area with correct scaling
        ctx.drawImage(
          img,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          sw,
          sh
        );

        // Run local OCR
        let text = '';
        if (!skipOcr) {
          text = await recognizeImageRegion(canvas, tier, language, (progress) => {
            // Send progress back to background (which will relay it to content script)
            chrome.runtime.sendMessage({
              type: 'OCR_PROGRESS',
              progress
            }).catch(() => {
              // Ignore channel closed errors if background is not listening
            });
          });
        }

        const croppedDataUrl = canvas.toDataURL('image/png');
        resolve({ text, croppedDataUrl });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load captured viewport image'));
    };
    img.src = dataUrl;
  });
}
