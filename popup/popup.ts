import { SettingsManager } from '../src/services/settings';
import type { TargetLanguage } from '../src/services/translation-plan';

const activeToggle = document.getElementById('active-toggle') as HTMLInputElement;
const primaryLang = document.getElementById('primary-lang') as HTMLSelectElement;
const secondaryLang = document.getElementById('secondary-lang') as HTMLSelectElement;
const reverseLang = document.getElementById('reverse-lang') as HTMLSelectElement;
const hotkey = document.getElementById('hotkey') as HTMLSelectElement;
const ocrShortcut = document.getElementById('ocr-shortcut') as HTMLSelectElement;
const ocrModelTier = document.getElementById('ocr-model-tier') as HTMLSelectElement;
const ttsToggle = document.getElementById('tts-toggle') as HTMLInputElement;
const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const deeplKeyContainer = document.getElementById('deepl-key-container') as HTMLDivElement;
const deeplApiKeyInput = document.getElementById('deepl-api-key') as HTMLInputElement;
const toggleDeeplKeyBtn = document.getElementById('toggle-deepl-key') as HTMLButtonElement;
const deeplKeyStatus = document.getElementById('deepl-key-status') as HTMLParagraphElement;
const statusMsg = document.getElementById('status-msg') as HTMLDivElement;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let validationTimeout: ReturnType<typeof setTimeout> | null = null;

function showStatus() {
  if (statusMsg) {
    statusMsg.classList.remove('opacity-0');
    statusMsg.classList.add('opacity-100');
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      statusMsg.classList.remove('opacity-100');
      statusMsg.classList.add('opacity-0');
    }, 1500);
  }
}

function updateDeepLContainer() {
  if (providerSelect.value === 'deepl') {
    deeplKeyContainer.classList.remove('hidden');
  } else {
    deeplKeyContainer.classList.add('hidden');
  }
}

async function validateDeepLKey(key: string): Promise<boolean> {
  if (!key) return false;
  const isFree = key.endsWith(':fx');
  const url = isFree 
    ? 'https://api-free.deepl.com/v2/usage' 
    : 'https://api.deepl.com/v2/usage';
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `DeepL-Auth-Key ${key}`
      }
    });
    return res.ok;
  } catch {
    return false;
  }
}

function showKeyMessage(msg: string, type: 'info' | 'success' | 'error') {
  if (!deeplKeyStatus) return;
  deeplKeyStatus.textContent = msg;
  deeplKeyStatus.classList.remove('hidden', 'text-rose-500', 'text-emerald-400', 'text-slate-400');
  
  if (type === 'error') {
    deeplKeyStatus.classList.add('text-rose-500');
  } else if (type === 'success') {
    deeplKeyStatus.classList.add('text-emerald-400');
  } else {
    deeplKeyStatus.classList.add('text-slate-400');
  }
}

function hideKeyMessages() {
  if (deeplKeyStatus) {
    deeplKeyStatus.classList.add('hidden');
  }
}

function triggerKeyValidation() {
  if (validationTimeout) clearTimeout(validationTimeout);
  
  hideKeyMessages();
  
  if (providerSelect.value !== 'deepl') return;
  
  const key = deeplApiKeyInput.value.trim();
  if (!key) {
    showKeyMessage('Please enter your DeepL API Key.', 'info');
    return;
  }
  
  validationTimeout = setTimeout(async () => {
    showKeyMessage('Validating API Key...', 'info');
    const isValid = await validateDeepLKey(key);
    if (isValid) {
      showKeyMessage('✓ API Key is valid', 'success');
    } else {
      showKeyMessage('✗ API Key is invalid or expired', 'error');
    }
  }, 600);
}

async function loadSettings() {
  try {
    const settings = await SettingsManager.getSettings();
    const res = await chrome.storage.local.get('active');
    const active = res.active !== undefined ? res.active : true;

    activeToggle.checked = active;
    primaryLang.value = settings.primaryTargetLang;
    secondaryLang.value = settings.secondaryTargetLang;
    reverseLang.value = settings.reverseTargetLang;
    hotkey.value = settings.hotkey;
    ocrShortcut.value = settings.ocrShortcut;
    ocrModelTier.value = settings.ocrModelTier;
    ttsToggle.checked = settings.ttsEnabled;
    providerSelect.value = settings.provider;
    deeplApiKeyInput.value = settings.deeplApiKey;

    updateDeepLContainer();
    triggerKeyValidation();
  } catch (err) {
    console.error('Failed to load settings in popup:', err);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ active: activeToggle.checked });
    
    await SettingsManager.updateSettings({
      primaryTargetLang: primaryLang.value as TargetLanguage,
      secondaryTargetLang: secondaryLang.value as TargetLanguage,
      reverseTargetLang: reverseLang.value as TargetLanguage,
      hotkey: hotkey.value as 'none' | 'ctrl' | 'alt' | 'shift',
      ocrShortcut: ocrShortcut.value as 'disabled' | 'ctrl-space' | 'alt-o' | 'ctrl-shift-o',
      ocrModelTier: ocrModelTier.value as 'tiny' | 'small' | 'medium',
      ttsEnabled: ttsToggle.checked,
      provider: providerSelect.value as 'google' | 'deepl',
      deeplApiKey: deeplApiKeyInput.value,
    });

    // Notify active tabs of settings update
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED' }).catch(() => {
            // Ignore error for tabs that don't have our content-script loaded
          });
        }
      });
    });

    showStatus();
  } catch (err) {
    console.error('Failed to save settings in popup:', err);
  }
}

// Bind change events
activeToggle.addEventListener('change', saveSettings);
primaryLang.addEventListener('change', saveSettings);
secondaryLang.addEventListener('change', saveSettings);
reverseLang.addEventListener('change', saveSettings);
hotkey.addEventListener('change', saveSettings);
ocrShortcut.addEventListener('change', saveSettings);
ocrModelTier.addEventListener('change', saveSettings);
ttsToggle.addEventListener('change', saveSettings);

providerSelect.addEventListener('change', () => {
  updateDeepLContainer();
  triggerKeyValidation();
  saveSettings();
});

deeplApiKeyInput.addEventListener('input', () => {
  triggerKeyValidation();
  saveSettings();
});

// Password visibility toggle
toggleDeeplKeyBtn.addEventListener('click', () => {
  if (deeplApiKeyInput.type === 'password') {
    deeplApiKeyInput.type = 'text';
    toggleDeeplKeyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228L3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    `;
  } else {
    deeplApiKeyInput.type = 'password';
    toggleDeeplKeyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    `;
  }
});

// Load on startup
document.addEventListener('DOMContentLoaded', loadSettings);
loadSettings();
