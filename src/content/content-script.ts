import {
  createTranslationContext,
  loadSettings,
  initTranslationListeners,
  matchesOcrShortcut,
} from './translation-init';
import { toggleWebpageOcr } from './ocr-selection';
import { initPinnedSnippetsSync } from './pinned-panel';
import { InputReplacementController } from './input-replacement';
import { createInputReplacementAdapter } from './input-replacement-dom';
import { InputReplacementShortcutTracker } from './input-replacement-shortcut';

const ctx = createTranslationContext();
const inputReplacementController = new InputReplacementController(createInputReplacementAdapter());
let inputShortcutTracker: InputReplacementShortcutTracker | null = null;
let trackedInputShortcut = '';

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

function getInputShortcutTracker(): InputReplacementShortcutTracker | null {
  const settings = ctx.settings;
  if (!settings?.inputReplacementEnabled || settings.inputReplacementShortcut === 'disabled') return null;
  if (!inputShortcutTracker || trackedInputShortcut !== settings.inputReplacementShortcut) {
    trackedInputShortcut = settings.inputReplacementShortcut;
    inputShortcutTracker = new InputReplacementShortcutTracker(trackedInputShortcut);
  }
  return inputShortcutTracker;
}

function triggerInputReplacement(event: KeyboardEvent, keyPhase: 'down' | 'up'): void {
  if (!ctx.active) return;
  const tracker = getInputShortcutTracker();
  if (!tracker) return;
  const matched = keyPhase === 'down' ? tracker.handleKeyDown(event) : tracker.handleKeyUp(event);
  if (matched && inputReplacementController.trigger()) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

document.addEventListener('keydown', (event) => triggerInputReplacement(event, 'down'), true);
document.addEventListener('keyup', (event) => triggerInputReplacement(event, 'up'), true);

// Attach OCR Shortcut listener to toggle webpage OCR Selection Mode
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented) return;
  if (!ctx.active || !ctx.settings) return;

  const isOcrNeeded = ctx.settings.autoTranslate || ctx.settings.ocrPinImage || ctx.settings.ocrCopyToClipboard;
  if (!isOcrNeeded) return;

  if (matchesOcrShortcut(ctx, event)) {
    event.preventDefault();
    toggleWebpageOcr(ctx);
  }
});


