import { TranslationContext, performTranslation } from './translation-init';
import { addPinnedSnippet } from './pinned-panel';

let overlayContainer: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let overlayEl: HTMLDivElement | null = null;
let selectionBox: HTMLDivElement | null = null;
let progressIndicator: HTMLDivElement | null = null;

let isSelecting = false;
let ocrBusy = false;
let startX = 0;
let startY = 0;

let currentCtx: TranslationContext | null = null;

// Listen to keydown to cancel selection on Escape
const globalKeydownListener = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && (overlayContainer || ocrBusy)) {
    e.preventDefault();
    cleanupOverlay();
  }
};

// Listen to progress updates relayed from the service worker
const chromeMessageListener = (message: any) => {
  if (message.type === 'OCR_PROGRESS') {
    updateProgressText(message.progress.message);
  }
};

export function isWebpageOcrActive(): boolean {
  return overlayContainer !== null;
}

export function toggleWebpageOcr(ctx: TranslationContext): void {
  if (ocrBusy) return;

  if (overlayContainer) {
    cleanupOverlay();
  } else {
    currentCtx = ctx;
    initOverlay();
  }
}

function initOverlay() {
  document.addEventListener('keydown', globalKeydownListener, true);
  chrome.runtime.onMessage.addListener(chromeMessageListener);

  overlayContainer = document.createElement('div');
  overlayContainer.id = 'polytranslate-ocr-overlay-root';
  overlayContainer.style.position = 'fixed';
  overlayContainer.style.inset = '0';
  overlayContainer.style.zIndex = '2147483640';
  overlayContainer.style.pointerEvents = 'auto';

  shadowRoot = overlayContainer.attachShadow({ mode: 'open' });

  // Add keyframes & simple styling inside the shadow root
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.2);
      cursor: crosshair;
      user-select: none;
      box-sizing: border-box;
    }
    .selection-box {
      position: absolute;
      border: 2px solid #89b4fa;
      background: rgba(137, 180, 250, 0.16);
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
      pointer-events: none;
      box-sizing: border-box;
    }
    .ocr-progress-indicator {
      position: absolute;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: 320px;
      min-height: 28px;
      padding: 6px 12px;
      border-radius: 8px;
      background: rgba(30, 30, 46, 0.96);
      border: 1px solid rgba(137, 180, 250, 0.35);
      color: #cdd6f4;
      font-size: 13px;
      line-height: 1.3;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-sizing: border-box;
      z-index: 10;
    }
    .mini-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #313244;
      border-top-color: #89b4fa;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex: 0 0 auto;
      box-sizing: border-box;
    }
  `;
  shadowRoot.appendChild(styleEl);

  overlayEl = document.createElement('div');
  overlayEl.className = 'overlay';
  shadowRoot.appendChild(overlayEl);

  overlayEl.addEventListener('mousedown', startSelection);
  overlayEl.addEventListener('mousemove', moveSelection);
  window.addEventListener('mouseup', finishSelection);

  document.body.appendChild(overlayContainer);
}

function cleanupOverlay() {
  document.removeEventListener('keydown', globalKeydownListener, true);
  chrome.runtime.onMessage.removeListener(chromeMessageListener);

  if (overlayContainer) {
    overlayContainer.remove();
    overlayContainer = null;
    shadowRoot = null;
    overlayEl = null;
    selectionBox = null;
    progressIndicator = null;
  }
  isSelecting = false;
  ocrBusy = false;
}

function startSelection(e: MouseEvent) {
  if (e.button !== 0 || ocrBusy) return; // Left click only

  e.preventDefault();
  e.stopPropagation();

  isSelecting = true;
  startX = e.clientX;
  startY = e.clientY;

  selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  shadowRoot!.appendChild(selectionBox);

  updateSelectionBoxSize(startX, startY, startX, startY);
}

function moveSelection(e: MouseEvent) {
  if (!isSelecting || !selectionBox) return;

  updateSelectionBoxSize(startX, startY, e.clientX, e.clientY);
}

async function finishSelection(e: MouseEvent) {
  if (!isSelecting || !selectionBox || !overlayEl) return;
  isSelecting = false;

  const endX = e.clientX;
  const endY = e.clientY;

  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  // If selection is too small, cancel
  if (width < 8 || height < 8) {
    selectionBox.remove();
    selectionBox = null;
    return;
  }

  // Hide selection box and overlay backdrop to prevent them from appearing in the screenshot
  if (selectionBox) selectionBox.style.display = 'none';
  if (overlayEl) overlayEl.style.display = 'none';

  // Show progress indicator
  if (currentCtx?.settings?.autoTranslate) {
    showProgress(left, top + height, 'Preparing OCR...');
  } else if (currentCtx?.settings?.ocrPinImage) {
    showProgress(left, top + height, 'Pinning image...');
  } else {
    showProgress(left, top + height, 'Copying image...');
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
            devicePixelRatio: window.devicePixelRatio
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
          updateProgressText('No text found in this region.');
          await new Promise((r) => setTimeout(r, 2000));
        }
      } else {
        updateProgressText('No text found in this region.');
        await new Promise((r) => setTimeout(r, 2000));
      }
    } else {
      console.error('OCR Error response:', response?.error);
      updateProgressText(response?.error || 'OCR selection failed.');
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (err: any) {
    console.error('OCR failed:', err);
    updateProgressText(err.message || 'OCR selection failed.');
    await new Promise((r) => setTimeout(r, 2000));
  } finally {
    cleanupOverlay();
  }
}

function updateSelectionBoxSize(x1: number, y1: number, x2: number, y2: number) {
  if (!selectionBox) return;
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

function showProgress(left: number, top: number, message: string) {
  if (!shadowRoot) return;

  progressIndicator = document.createElement('div');
  progressIndicator.className = 'ocr-progress-indicator';
  progressIndicator.innerHTML = `
    <div class="mini-spinner"></div>
    <span class="progress-text">${message}</span>
  `;

  // Place it below the crop region, clamping within viewport
  progressIndicator.style.left = `${Math.max(8, left)}px`;
  progressIndicator.style.top = `${top + 8}px`;

  shadowRoot.appendChild(progressIndicator);
}

function updateProgressText(message: string) {
  if (!progressIndicator) return;
  const textEl = progressIndicator.querySelector('.progress-text');
  if (textEl) {
    textEl.textContent = message;
  }
}

async function copyImageToClipboard(dataUrl: string): Promise<void> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const item = new ClipboardItem({ 'image/png': blob });
  await navigator.clipboard.write([item]);
}
