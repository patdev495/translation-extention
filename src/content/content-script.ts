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

// Helper to check if hotkey is pressed
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

document.addEventListener('mouseup', (event) => {
  const currentSettings = settings;
  if (!active || !currentSettings) return;

  // Capture mouse coordinates and target synchronously
  const x = event.pageX;
  const y = event.pageY;
  const target = event.target;
  const isHotkey = isHotkeyMatched(event);

  setTimeout(async () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length === 0) {
      return;
    }

    // Check if clicked inside our own tooltip root
    const root = document.getElementById('translation-extension-root');
    if (root && root.contains(target as Node)) return;

    // Check hotkey constraint
    if (!isHotkey) return;

    // Save selection context at cursor position
    lastSelection = { text: selectedText, x, y };

    if (currentSettings.triggerMode === 'auto') {
      performTranslation(selectedText, x, y);
    } else {
      tooltip.showTrigger(x, y - 8);
    }
  }, 10);
});

document.addEventListener('mousedown', (event) => {
  const root = document.getElementById('translation-extension-root');
  if (root && root.contains(event.target as Node)) return;
  
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
        tooltip.show(x, y - 8, text, response.data);
      } else {
        console.error('Translation error:', response?.error);
      }
    }
  );
}
