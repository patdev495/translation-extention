import {
  createTranslationContext,
  loadSettings,
  initTranslationListeners,
} from './translation-init';

const ctx = createTranslationContext();

console.log('PolyTranslate Content Script initialized!');

// Load settings on startup
loadSettings(ctx);

// Listen for updates from settings popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SETTINGS_UPDATED') {
    loadSettings(ctx);
  }
});

// Attach all translation event listeners to the document
initTranslationListeners(ctx, document);

