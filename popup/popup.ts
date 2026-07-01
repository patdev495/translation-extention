import { SettingsManager } from '../src/services/settings';

const activeToggle = document.getElementById('active-toggle') as HTMLInputElement;
const primaryLang = document.getElementById('primary-lang') as HTMLSelectElement;
const secondaryLang = document.getElementById('secondary-lang') as HTMLSelectElement;
const reverseLang = document.getElementById('reverse-lang') as HTMLSelectElement;
const triggerMode = document.getElementById('trigger-mode') as HTMLSelectElement;
const hotkey = document.getElementById('hotkey') as HTMLSelectElement;
const ttsToggle = document.getElementById('tts-toggle') as HTMLInputElement;
const statusMsg = document.getElementById('status-msg') as HTMLDivElement;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

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

async function loadSettings() {
  try {
    const settings = await SettingsManager.getSettings();
    const res = await chrome.storage.local.get('active');
    const active = res.active !== undefined ? res.active : true;

    activeToggle.checked = active;
    primaryLang.value = settings.primaryTargetLang;
    secondaryLang.value = settings.secondaryTargetLang;
    reverseLang.value = settings.reverseTargetLang;
    triggerMode.value = settings.triggerMode;
    hotkey.value = settings.hotkey;
    ttsToggle.checked = settings.ttsEnabled;
  } catch (err) {
    console.error('Failed to load settings in popup:', err);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ active: activeToggle.checked });
    
    await SettingsManager.updateSettings({
      primaryTargetLang: primaryLang.value,
      secondaryTargetLang: secondaryLang.value,
      reverseTargetLang: reverseLang.value,
      triggerMode: triggerMode.value as 'auto' | 'icon',
      hotkey: hotkey.value as 'none' | 'ctrl' | 'alt' | 'shift',
      ttsEnabled: ttsToggle.checked,
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
triggerMode.addEventListener('change', saveSettings);
hotkey.addEventListener('change', saveSettings);
ttsToggle.addEventListener('change', saveSettings);

// Load on startup
document.addEventListener('DOMContentLoaded', loadSettings);
loadSettings(); // Also call immediately to ensure it loads
