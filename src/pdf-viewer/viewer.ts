import {
  createTranslationContext,
  loadSettings,
  initTranslationListeners,
  performTranslation,
  matchesOcrShortcut,
} from '../content/translation-init';
import { recognizeImageRegion } from '../services/ocr';
import { createPdfPasswordResolver } from './password';

// pdfjs-dist is loaded at runtime via chrome.runtime.getURL() to avoid
// bundling the entire library (~3MB) into the viewer chunk.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any;
let TextLayer: any;

// ─── PDF.js Worker ─────────────────────────────────────────────────────────

async function loadPdfjsLib() {
  const pdfUrl = chrome.runtime.getURL('pdf.min.mjs');
  const mod = await import(/* @vite-ignore */ pdfUrl);
  pdfjsLib = mod;
  TextLayer = mod.TextLayer;
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
}

// ─── DOM refs ──────────────────────────────────────────────────────────────

const $loading       = document.getElementById('loading-overlay')!;
const $loadingText   = document.getElementById('loading-text')!;
const $errorOverlay  = document.getElementById('error-overlay')!;
const $errorMsg      = document.getElementById('error-message')!;
const $btnFileAccess = document.getElementById('btn-enable-file-access') as HTMLButtonElement;
const $pwdOverlay    = document.getElementById('password-overlay')!;
const $pwdInput      = document.getElementById('password-input') as HTMLInputElement;
const $pwdError      = document.getElementById('password-error')!;
const $btnPwdSubmit  = document.getElementById('btn-password-submit')!;
const $btnPwdCancel  = document.getElementById('btn-password-cancel')!;
const $pagesContainer = document.getElementById('pages-container')!;
const $pdfTitle      = document.getElementById('pdf-title')!;
const $pageInput     = document.getElementById('page-input') as HTMLInputElement;
const $pageTotal     = document.getElementById('page-total')!;
const $zoomLevel     = document.getElementById('zoom-level')!;
const $btnPrev       = document.getElementById('btn-prev')!;
const $btnNext       = document.getElementById('btn-next')!;
const $btnOcrRegion  = document.getElementById('btn-ocr-region') as HTMLButtonElement;
const $btnZoomIn     = document.getElementById('btn-zoom-in')!;
const $btnZoomOut    = document.getElementById('btn-zoom-out')!;
const $btnZoomFit    = document.getElementById('btn-zoom-fit')!;
const $viewerContainer = document.getElementById('viewer-container')!;

// ─── State ─────────────────────────────────────────────────────────────────

let pdfDoc: any = null;
let numPages = 0;
let scale = 1.0;
let currentPage = 1;
const translationCtx = createTranslationContext();
let ocrSelectionMode = false;
let ocrBusy = false;
let ocrSelection: {
  pageWrapper: HTMLElement;
  pageCanvas: HTMLCanvasElement;
  boxEl: HTMLDivElement;
  startX: number;
  startY: number;
} | null = null;

// Per-page render state: tracks running render tasks and rendered canvases
const pageRendered = new Map<number, boolean>();
const pageRenderTask = new Map<number, any>();

// ─── URL Parsing ───────────────────────────────────────────────────────────

function getPdfUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('file');
}

// ─── Show / hide helpers ───────────────────────────────────────────────────

function showLoading(msg = 'Loading PDF…') {
  $loadingText.textContent = msg;
  $loading.removeAttribute('hidden');
  $errorOverlay.setAttribute('hidden', '');
}

function hideLoading() {
  $loading.setAttribute('hidden', '');
}

function showError(msg: string, isFileAccess = false) {
  hideLoading();
  $errorMsg.textContent = msg;
  if (isFileAccess) {
    $btnFileAccess.removeAttribute('hidden');
  } else {
    $btnFileAccess.setAttribute('hidden', '');
  }
  $errorOverlay.removeAttribute('hidden');
}

// ─── Password dialog ───────────────────────────────────────────────────────

function promptPassword(wrongPassword: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    $pwdInput.value = '';
    $pwdError.hidden = !wrongPassword;
    $pwdOverlay.removeAttribute('hidden');
    $pwdInput.focus();

    const onSubmit = () => {
      const pw = $pwdInput.value;
      $pwdOverlay.setAttribute('hidden', '');
      cleanup();
      resolve(pw);
    };

    const onCancel = () => {
      $pwdOverlay.setAttribute('hidden', '');
      cleanup();
      resolve(null);
    };

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onSubmit();
      if (e.key === 'Escape') onCancel();
    };

    function cleanup() {
      $btnPwdSubmit.removeEventListener('click', onSubmit);
      $btnPwdCancel.removeEventListener('click', onCancel);
      $pwdInput.removeEventListener('keydown', onKeydown);
    }

    $btnPwdSubmit.addEventListener('click', onSubmit);
    $btnPwdCancel.addEventListener('click', onCancel);
    $pwdInput.addEventListener('keydown', onKeydown);
  });
}

// ─── Load PDF ──────────────────────────────────────────────────────────────

async function loadPdf(url: string, password?: string): Promise<void> {
  showLoading('Loading PDF…');

  try {
    const loadingTask = pdfjsLib.getDocument({
      url,
      password: password ?? '',
    });
    const resolvePdfPassword = createPdfPasswordResolver(promptPassword, {
      allowPrompt: false,
      maxEmptyPasswordAttempts: 3,
    });

    loadingTask.onPassword = async (updatePassword: (pw: string) => void, reason: number) => {
      const resolved = await resolvePdfPassword(updatePassword, reason);
      if (!resolved) {
        showError('Could not open this PDF without a password. Chrome may support this file, but PDF.js cannot decode it without password handling.');
        loadingTask.destroy();
      }
    };

    pdfDoc = await loadingTask.promise;
    numPages = pdfDoc.numPages;

    // Update title
    const meta = await pdfDoc.getMetadata().catch(() => null);
    const title = (meta?.info as any)?.Title || decodeURIComponent(url.split('/').pop() || 'PDF');
    document.title = `${title} — PolyTranslate`;
    $pdfTitle.textContent = title;
    $pageTotal.textContent = `/ ${numPages}`;
    $pageInput.max = String(numPages);

    hideLoading();
    buildPagePlaceholders();
    observePages();
    scrollToPage(1);
  } catch (err: any) {
    const msg = err?.message || String(err);

    // Local file access denied
    if (url.startsWith('file://') && msg.includes('Access')) {
      showError(
        'Chrome blocked access to local files. Enable "Allow access to file URLs" in the extension settings.',
        true
      );
      return;
    }

    showError(`Could not load PDF: ${msg}`);
  }
}

// ─── Page layout ───────────────────────────────────────────────────────────

function buildPagePlaceholders() {
  $pagesContainer.innerHTML = '';
  pageRendered.clear();

  for (let i = 1; i <= numPages; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.id = `page-${i}`;
    // Placeholder height — will be updated on first render
    wrapper.style.width = '600px';
    wrapper.style.height = '800px';
    $pagesContainer.appendChild(wrapper);
  }
}

// ─── Lazy render via IntersectionObserver ──────────────────────────────────

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const pageNum = parseInt((entry.target as HTMLElement).id.replace('page-', ''), 10);
      if (entry.isIntersecting) {
        renderPage(pageNum);
      }
    }
  },
  { root: $viewerContainer, rootMargin: '200px 0px', threshold: 0 }
);

function observePages() {
  for (let i = 1; i <= numPages; i++) {
    const el = document.getElementById(`page-${i}`);
    if (el) observer.observe(el);
  }
}

// ─── Render a single page ──────────────────────────────────────────────────

async function renderPage(pageNum: number) {
  if (!pdfDoc) return;
  if (pageRendered.get(pageNum)) return;
  pageRendered.set(pageNum, true);

  const wrapper = document.getElementById(`page-${pageNum}`);
  if (!wrapper) return;

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // Resize placeholder
  wrapper.style.width = `${viewport.width}px`;
  wrapper.style.height = `${viewport.height}px`;
  wrapper.innerHTML = '';

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  wrapper.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  const renderTask = page.render({ canvasContext: ctx, canvas, viewport });
  pageRenderTask.set(pageNum, renderTask);

  await renderTask.promise.catch(() => {/* cancelled */});

  // Text layer for selection
  const textContent = await page.getTextContent();
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  wrapper.appendChild(textLayerDiv);

  const textLayer = new TextLayer({
    textContentSource: textContent,
    container: textLayerDiv,
    viewport,
  });
  await textLayer.render();
}

// ─── Re-render all pages on zoom ───────────────────────────────────────────

async function rerenderAll() {
  if (!pdfDoc) return;
  pageRendered.clear();
  pageRenderTask.forEach((t) => t.cancel());
  pageRenderTask.clear();

  for (let i = 1; i <= numPages; i++) {
    const wrapper = document.getElementById(`page-${i}`);
    if (wrapper) wrapper.innerHTML = '';
  }

  // Re-observe to trigger visible pages
  observer.disconnect();
  observePages();
}

// ─── Navigation helpers ────────────────────────────────────────────────────

function scrollToPage(pageNum: number) {
  const el = document.getElementById(`page-${pageNum}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateCurrentPageFromScroll() {
  for (let i = 1; i <= numPages; i++) {
    const el = document.getElementById(`page-${i}`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.top >= 0 || rect.bottom > 0) {
      currentPage = i;
      $pageInput.value = String(i);
      break;
    }
  }
}

// ─── Toolbar controls ──────────────────────────────────────────────────────

function setOcrSelectionMode(enabled: boolean) {
  ocrSelectionMode = enabled;
  document.body.classList.toggle('ocr-selection-mode', enabled);
  $btnOcrRegion.classList.toggle('active', enabled);
  $btnOcrRegion.setAttribute('aria-pressed', String(enabled));
  $btnOcrRegion.title = enabled
    ? 'OCR region selection is active'
    : 'Select image region for OCR translation (Ctrl+Space)';
}

function getPointInPage(wrapper: HTMLElement, event: MouseEvent) {
  const rect = wrapper.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(event.clientX - rect.left, rect.width)),
    y: Math.max(0, Math.min(event.clientY - rect.top, rect.height)),
  };
}

function updateSelectionBox(boxEl: HTMLElement, startX: number, startY: number, endX: number, endY: number) {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  boxEl.style.left = `${left}px`;
  boxEl.style.top = `${top}px`;
  boxEl.style.width = `${width}px`;
  boxEl.style.height = `${height}px`;
}

function removeOcrProgress() {
  document.querySelectorAll('.ocr-progress-indicator').forEach((el) => el.remove());
}

function showOcrProgress(wrapper: HTMLElement, rect: DOMRect, message: string) {
  removeOcrProgress();
  const indicator = document.createElement('div');
  indicator.className = 'ocr-progress-indicator';
  indicator.innerHTML = '<span class="mini-spinner"></span><span></span>';
  const textEl = indicator.querySelector('span:last-child')!;
  textEl.textContent = message;
  indicator.style.left = `${rect.left}px`;
  indicator.style.top = `${Math.max(8, rect.top - 34)}px`;
  wrapper.appendChild(indicator);
  return indicator;
}

function cropPageCanvas(pageCanvas: HTMLCanvasElement, wrapper: HTMLElement, rect: DOMRect): HTMLCanvasElement {
  const canvasRect = pageCanvas.getBoundingClientRect();
  const scaleX = pageCanvas.width / canvasRect.width;
  const scaleY = pageCanvas.height / canvasRect.height;
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(1, Math.round(rect.width * scaleX));
  cropCanvas.height = Math.max(1, Math.round(rect.height * scaleY));

  const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true })!;
  const wrapperRect = wrapper.getBoundingClientRect();
  const sx = Math.round((wrapperRect.left + rect.left - canvasRect.left) * scaleX);
  const sy = Math.round((wrapperRect.top + rect.top - canvasRect.top) * scaleY);
  cropCtx.drawImage(pageCanvas, sx, sy, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);
  return cropCanvas;
}

async function translateOcrRegion(wrapper: HTMLElement, pageCanvas: HTMLCanvasElement, rect: DOMRect) {
  if (ocrBusy || rect.width < 8 || rect.height < 8) return;
  ocrBusy = true;

  const progress = showOcrProgress(wrapper, rect, 'Preparing OCR...');
  try {
    const cropCanvas = cropPageCanvas(pageCanvas, wrapper, rect);
    const tier = translationCtx.settings?.ocrModelTier ?? 'small';
    const text = await recognizeImageRegion(cropCanvas, tier, (state) => {
      const textEl = progress.querySelector('span:last-child');
      if (textEl) textEl.textContent = state.message;
    });

    if (!text) {
      const textEl = progress.querySelector('span:last-child');
      if (textEl) textEl.textContent = 'No text found in this region.';
      window.setTimeout(removeOcrProgress, 1800);
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const x = wrapperRect.left + window.scrollX + rect.left + rect.width / 2;
    const y = wrapperRect.top + window.scrollY + rect.top;
    removeOcrProgress();
    performTranslation(translationCtx, text, x, y);
  } catch (err) {
    const textEl = progress.querySelector('span:last-child');
    if (textEl) textEl.textContent = err instanceof Error ? err.message : 'OCR failed.';
    window.setTimeout(removeOcrProgress, 3000);
  } finally {
    ocrBusy = false;
    setOcrSelectionMode(false);
  }
}

function startOcrSelection(event: MouseEvent) {
  if (!ocrSelectionMode || ocrBusy) return;

  const wrapper = (event.target as Element | null)?.closest('.page-wrapper') as HTMLElement | null;
  if (!wrapper) return;
  const pageCanvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!pageCanvas) return;

  event.preventDefault();
  event.stopPropagation();
  window.getSelection()?.removeAllRanges();

  const point = getPointInPage(wrapper, event);
  const boxEl = document.createElement('div');
  boxEl.className = 'ocr-selection-box';
  wrapper.appendChild(boxEl);
  updateSelectionBox(boxEl, point.x, point.y, point.x, point.y);

  ocrSelection = {
    pageWrapper: wrapper,
    pageCanvas,
    boxEl,
    startX: point.x,
    startY: point.y,
  };
}

function moveOcrSelection(event: MouseEvent) {
  if (!ocrSelection) return;
  event.preventDefault();
  const point = getPointInPage(ocrSelection.pageWrapper, event);
  updateSelectionBox(ocrSelection.boxEl, ocrSelection.startX, ocrSelection.startY, point.x, point.y);
}

function finishOcrSelection(event: MouseEvent) {
  if (!ocrSelection) return;
  event.preventDefault();

  const selection = ocrSelection;
  ocrSelection = null;
  const point = getPointInPage(selection.pageWrapper, event);
  const rect = new DOMRect(
    Math.min(selection.startX, point.x),
    Math.min(selection.startY, point.y),
    Math.abs(point.x - selection.startX),
    Math.abs(point.y - selection.startY)
  );
  selection.boxEl.remove();
  translateOcrRegion(selection.pageWrapper, selection.pageCanvas, rect);
}

$btnPrev.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    $pageInput.value = String(currentPage);
    scrollToPage(currentPage);
  }
});

$btnNext.addEventListener('click', () => {
  if (currentPage < numPages) {
    currentPage++;
    $pageInput.value = String(currentPage);
    scrollToPage(currentPage);
  }
});

$pageInput.addEventListener('change', () => {
  const n = parseInt($pageInput.value, 10);
  if (n >= 1 && n <= numPages) {
    currentPage = n;
    scrollToPage(currentPage);
  }
});

$btnZoomIn.addEventListener('click', () => {
  scale = Math.min(scale + 0.2, 3.0);
  $zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  rerenderAll();
});

$btnZoomOut.addEventListener('click', () => {
  scale = Math.max(scale - 0.2, 0.4);
  $zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  rerenderAll();
});

$btnZoomFit.addEventListener('click', async () => {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const containerWidth = $viewerContainer.clientWidth - 48;
  scale = containerWidth / vp.width;
  $zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  rerenderAll();
});

$btnOcrRegion.addEventListener('click', () => {
  if (ocrBusy) return;
  setOcrSelectionMode(!ocrSelectionMode);
});

document.addEventListener('keydown', (event) => {
  if (matchesOcrShortcut(translationCtx, event)) {
    event.preventDefault();
    if (!ocrBusy) setOcrSelectionMode(!ocrSelectionMode);
    return;
  }

  if (event.key === 'Escape' && ocrSelectionMode) {
    event.preventDefault();
    ocrSelection?.boxEl.remove();
    ocrSelection = null;
    setOcrSelectionMode(false);
  }
});

$viewerContainer.addEventListener('mousedown', startOcrSelection, true);
$viewerContainer.addEventListener('mousemove', moveOcrSelection, true);
document.addEventListener('mouseup', finishOcrSelection, true);

$viewerContainer.addEventListener('scroll', updateCurrentPageFromScroll);

// ─── File access button ────────────────────────────────────────────────────

$btnFileAccess.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_EXTENSION_SETTINGS' });
});

// ─── Translation init ──────────────────────────────────────────────────────

loadSettings(translationCtx);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    loadSettings(translationCtx);
  }
});

initTranslationListeners(translationCtx, document);

// ─── Bootstrap ─────────────────────────────────────────────────────────────

(async () => {
  // Load PDF.js library dynamically first
  await loadPdfjsLib();

  const url = getPdfUrl();
  if (!url) {
    showError('No PDF URL specified. Open a PDF via a link or file.');
    return;
  }

  // Set initial zoom to fit width
  try {
    const tempTask = pdfjsLib.getDocument({ url, password: '', stopAtErrors: true });
    tempTask.onPassword = (updatePassword: (pw: string) => void) => updatePassword('');
    const tempDoc = await tempTask.promise.catch(() => null);
    if (tempDoc) {
      const page = await tempDoc.getPage(1);
      const vp = page.getViewport({ scale: 1 });
      const containerWidth = $viewerContainer.clientWidth - 48;
      scale = Math.max(0.5, containerWidth / vp.width);
      $zoomLevel.textContent = `${Math.round(scale * 100)}%`;
      await tempDoc.cleanup();
    }
  } catch {
    // Ignore — will be handled by loadPdf
  }

  await loadPdf(url);
})();
