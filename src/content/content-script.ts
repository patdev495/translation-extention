import {
  createTranslationContext,
  loadSettings,
  initTranslationListeners,
  matchesOcrShortcut,
} from './translation-init';
import { toggleWebpageOcr } from './ocr-selection';
import { initPinnedSnippetsSync } from './pinned-panel';

const ctx = createTranslationContext();

console.log('PolyTranslate Content Script initialized!');

// Load settings on startup
loadSettings(ctx);
initPinnedSnippetsSync(document);

// Listen for updates from settings popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    loadSettings(ctx);
  }
});

// Attach all translation event listeners to the document
initTranslationListeners(ctx, document);

// Attach OCR Shortcut listener to toggle webpage OCR Selection Mode
document.addEventListener('keydown', (event) => {
  if (!ctx.active || !ctx.settings) return;

  if (matchesOcrShortcut(ctx, event)) {
    // If the active element is an input, textarea, or contenteditable, don't trigger the shortcut
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
      return;
    }

    event.preventDefault();
    toggleWebpageOcr(ctx);
  }
});


