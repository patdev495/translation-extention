import { TranslationTooltip } from './tooltip';
import { SettingsManager, Settings } from '../services/settings';

const tooltip = new TranslationTooltip();
let settings: Settings | null = null;
let active = true;

// Saved selection context for trigger button clicks
let lastSelection = {
  text: '',
  x: 0,
  y: 0
};

async function loadSettings() {
  try {
    settings = await SettingsManager.getSettings();
    const res = await chrome.storage.local.get('active');
    active = res.active !== undefined ? res.active : true;
    console.log('PolyTranslate settings loaded:', settings, 'active:', active);
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

console.log('PolyTranslate Content Script initialized!');
// Load settings on startup
loadSettings();

// Listen for updates from settings popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SETTINGS_UPDATED') {
    loadSettings();
  }
});

// Helper to check if hotkey is held
function isHotkeyMatched(event: MouseEvent): boolean {
  if (!settings) return true;
  switch (settings.hotkey) {
    case 'ctrl':
      return event.ctrlKey;
    case 'alt':
      return event.altKey;
    case 'shift':
      return event.shiftKey;
    case 'none':
    default:
      return true;
  }
}

// Helper to check if pressed key matches hotkey
function matchesHotkey(event: KeyboardEvent): boolean {
  if (!settings) return false;
  switch (settings.hotkey) {
    case 'ctrl':
      return event.key === 'Control';
    case 'alt':
      return event.key === 'Alt';
    case 'shift':
      return event.key === 'Shift';
    default:
      return false;
  }
}

// 1. Keydown event listener for triggering translation via hotkey press
document.addEventListener('keydown', (event) => {
  if (!active || !settings || event.repeat) return;

  if (matchesHotkey(event)) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    // Do not trigger if typing in form fields
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = rect.left + window.scrollX + (rect.width / 2);
    const y = rect.top + window.scrollY;

    // Save selection context
    lastSelection = { text: selectedText, x, y };

    performTranslation(selectedText, x, y);
  }
});

// 2. Mouseup event listener for selection tracking
document.addEventListener('mouseup', (event) => {
  const currentSettings = settings;
  if (!active || !currentSettings) return;

  // Capture mouse coordinates, target, and path synchronously
  const x = event.pageX;
  const y = event.pageY;
  const isHotkeyHeld = isHotkeyMatched(event);
  const root = document.getElementById('translation-extension-root');
  const isInsideRoot = root ? event.composedPath().includes(root) : false;

  setTimeout(async () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) return;

    // If clicked inside the tooltip root, do not trigger new selection
    if (isInsideRoot) return;

    // Save selection context
    lastSelection = { text: selectedText, x, y };

    if (currentSettings.hotkey === 'none') {
      // Hotkey is 'none' -> Auto translate immediately
      performTranslation(selectedText, x, y);
    } else {
      // Hotkey is configured:
      if (isHotkeyHeld) {
        // If hotkey was held during selection -> translate immediately
        performTranslation(selectedText, x, y);
      } else {
        // Otherwise, always show the floating trigger button (fallback option)
        tooltip.showTrigger(x, y - 8);
      }
    }
  }, 10);
});

document.addEventListener('mousedown', (event) => {
  const root = document.getElementById('translation-extension-root');
  const isInsideRoot = root ? event.composedPath().includes(root) : false;
  if (isInsideRoot) return;
  
  tooltip.hide();
  tooltip.hideTrigger();
});

// Handle trigger click
tooltip.onTriggerClick = () => {
  if (!settings) return;
  performTranslation(lastSelection.text, lastSelection.x, lastSelection.y);
};

function performTranslation(text: string, x: number, y: number) {
  if (!settings) return;
  
  chrome.runtime.sendMessage(
    { type: 'TRANSLATE', text },
    (response) => {
      if (response && response.success) {
        tooltip.show(x, y - 8, text, response.data, settings?.ttsEnabled ?? true);
      } else {
        console.error('Translation error:', response?.error);
      }
    }
  );
}
