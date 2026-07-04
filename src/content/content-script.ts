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

// Listen for storage changes to sync settings dynamically
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.settings || changes.active)) {
    loadSettings(ctx);
  }
});

// Attach all translation event listeners to the document
initTranslationListeners(ctx, document);

// Attach OCR Shortcut listener to toggle webpage OCR Selection Mode
document.addEventListener('keydown', (event) => {
  if (!ctx.active || !ctx.settings) return;

  const isOcrNeeded = ctx.settings.autoTranslate || ctx.settings.ocrPinImage || ctx.settings.ocrCopyToClipboard;
  if (!isOcrNeeded) return;

  if (matchesOcrShortcut(ctx, event)) {
    event.preventDefault();
    toggleWebpageOcr(ctx);
  }
});


