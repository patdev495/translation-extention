import { recognizeImageRegion } from '../services/ocr';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RUN_OCR') {
    const { dataUrl, rect, tier } = message;

    (async () => {
      try {
        const text = await processOcr(dataUrl, rect, tier);
        sendResponse({ success: true, text });
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
  tier: 'tiny' | 'small' | 'medium' = 'small'
): Promise<string> {
  const dpr = rect.devicePixelRatio || 1;
  const sx = rect.x * dpr;
  const sy = rect.y * dpr;
  const sw = rect.width * dpr;
  const sh = rect.height * dpr;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
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
        const text = await recognizeImageRegion(canvas, tier, (progress) => {
          // Send progress back to background (which will relay it to content script)
          chrome.runtime.sendMessage({
            type: 'OCR_PROGRESS',
            progress
          }).catch(() => {
            // Ignore channel closed errors if background is not listening
          });
        });

        resolve(text);
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
