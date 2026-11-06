import { SettingsManager } from '../src/services/settings';
import type { TargetLanguage } from '../src/services/translation-plan';
import { shortcutConflictsWithOcr, shortcutFromKeyboardEvent } from '../src/content/input-replacement-shortcut';
import {
  exportHanziLearningBackup, importHanziLearningBackup, inspectHanziLearningImport,
  parseHanziLearningBackup, type HanziLearningBackup,
} from '../src/services/hanzi-learning';

const activeToggle = document.getElementById('active-toggle') as HTMLInputElement;
const privacyConsentPanel = document.getElementById('privacy-consent') as HTMLElement;
const privacyConsentAccept = document.getElementById('privacy-consent-accept') as HTMLButtonElement;
let privacyConsentGranted = false;
const primaryLang = document.getElementById('primary-lang') as HTMLSelectElement;
const secondaryLang = document.getElementById('secondary-lang') as HTMLSelectElement;
const reverseLang = document.getElementById('reverse-lang') as HTMLSelectElement;
const inputReplacementEnabled = document.getElementById('input-replacement-enabled') as HTMLInputElement;
const inputReplacementShortcut = document.getElementById('input-replacement-shortcut') as HTMLInputElement;
const inputReplacementError = document.getElementById('input-replacement-error') as HTMLParagraphElement;
const ocrShortcut = document.getElementById('ocr-shortcut') as HTMLSelectElement;
const ocrModelTier = document.getElementById('ocr-model-tier') as HTMLSelectElement;
const ocrLanguage = document.getElementById('ocr-language') as HTMLSelectElement;
const ttsToggle = document.getElementById('tts-toggle') as HTMLInputElement;
const tooltipFontSizeSelect = document.getElementById('tooltip-font-size') as HTMLSelectElement;
const hanziStrokeSpeedSelect = document.getElementById('hanzi-stroke-speed') as HTMLSelectElement;
const hanziBreakdownToggle = document.getElementById('hanzi-breakdown-enabled') as HTMLInputElement;
const hanziBreakdownLanguageSelect = document.getElementById('hanzi-breakdown-language') as HTMLSelectElement;
const ocrPinToggle = document.getElementById('ocr-pin-toggle') as HTMLInputElement;
const ocrCopyToggle = document.getElementById('ocr-copy-toggle') as HTMLInputElement;
const autoTranslateToggle = document.getElementById('auto-translate') as HTMLInputElement;
const phoneticsToggle = document.getElementById('phonetics-toggle') as HTMLInputElement;
const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const deeplKeyContainer = document.getElementById('deepl-key-container') as HTMLDivElement;
const deeplApiKeyInput = document.getElementById('deepl-api-key') as HTMLInputElement;
const toggleDeeplKeyBtn = document.getElementById('toggle-deepl-key') as HTMLButtonElement;
const deeplKeyStatus = document.getElementById('deepl-key-status') as HTMLParagraphElement;
const statusMsg = document.getElementById('status-msg') as HTMLDivElement;
const hanziExportBackup = document.getElementById('hanzi-export-backup') as HTMLButtonElement;
const hanziImportBackup = document.getElementById('hanzi-import-backup') as HTMLButtonElement;
const hanziBackupFile = document.getElementById('hanzi-backup-file') as HTMLInputElement;
const hanziBackupStatus = document.getElementById('hanzi-backup-status') as HTMLParagraphElement;
const hanziImportChoice = document.getElementById('hanzi-import-choice') as HTMLDivElement;
const hanziImportSummary = document.getElementById('hanzi-import-summary') as HTMLParagraphElement;
const hanziImportKeepCurrent = document.getElementById('hanzi-import-keep-current') as HTMLButtonElement;
const hanziImportUseFile = document.getElementById('hanzi-import-use-file') as HTMLButtonElement;
const learningAccountStatus = document.getElementById('learning-account-status') as HTMLParagraphElement;
const learningAccountLink = document.getElementById('learning-account-link') as HTMLButtonElement;
const learningAccountUnlink = document.getElementById('learning-account-unlink') as HTMLButtonElement;
const learningSyncList = document.getElementById('learning-sync-list') as HTMLUListElement;
const learningSyncRetry = document.getElementById('learning-sync-retry') as HTMLButtonElement;
let pendingHanziBackup: HanziLearningBackup | null = null;

interface LinkStatus {
  state: 'unlinked' | 'pending' | 'linked' | 'error';
  username?: string;
  message?: string;
}

function renderLinkStatus(status: LinkStatus): void {
  learningAccountStatus.textContent = status.state === 'linked'
    ? `Đã liên kết: ${status.username ?? 'tài khoản web'}`
    : status.state === 'pending'
      ? status.message ?? 'Đang chờ xác nhận trên web.'
      : status.state === 'error'
        ? status.message ?? 'Liên kết thất bại.'
        : status.message ?? 'Chưa liên kết tài khoản web.';
  learningAccountLink.hidden = status.state === 'linked';
  learningAccountLink.textContent = status.state === 'pending' ? 'Mở lại trang liên kết' : 'Liên kết tài khoản';
  learningAccountUnlink.hidden = status.state !== 'linked';
}

async function sendLinkMessage(type: string): Promise<LinkStatus> {
  const response = await chrome.runtime.sendMessage({ type }) as { success?: boolean; status?: LinkStatus; error?: string };
  if (!response?.success || !response.status) throw new Error(response?.error ?? 'Không kết nối được extension.');
  return response.status;
}

async function refreshLinkStatus(): Promise<void> {
  try {
    renderLinkStatus(await sendLinkMessage('GET_ACCOUNT_LINK_STATUS'));
    await refreshSyncStatus();
  } catch {
    learningAccountStatus.textContent = 'Chưa kiểm tra được tài khoản. Hãy thử lại.';
  }
}

interface SyncStatusItem {
  id: string;
  choice: 'word' | 'sentence' | 'both';
  item: { text?: string; word_text?: string; sentence_text?: string };
  state: 'pending' | 'completed' | 'failed';
  error?: string;
}

async function refreshSyncStatus(type = 'LEARNING_SYNC_STATUS'): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type }) as { success?: boolean; result?: SyncStatusItem[] };
    if (!response?.success) throw new Error('Không tải được trạng thái đồng bộ.');
    learningSyncList.replaceChildren();
    const entries = (response.result ?? []).slice().reverse().slice(0, 20);
    if (!entries.length) {
      const row = document.createElement('li');
      row.textContent = 'Chưa có mục học tập chờ đồng bộ.';
      learningSyncList.append(row);
    }
    for (const entry of entries) {
      const row = document.createElement('li');
      row.dataset.state = entry.state;
      const text = document.createElement('span');
      text.textContent = entry.choice === 'both' ? `${entry.item.word_text} / ${entry.item.sentence_text}` : entry.item.text ?? '';
      const state = document.createElement('strong');
      state.textContent = entry.state === 'pending' ? 'Chờ đồng bộ' : entry.state === 'completed' ? 'Đã đồng bộ' : 'Thất bại';
      if (entry.error) row.title = entry.error;
      row.append(text, state);
      learningSyncList.append(row);
    }
  } catch {
    learningSyncList.textContent = 'Không tải được trạng thái đồng bộ.';
  }
}

learningSyncRetry.addEventListener('click', async () => {
  learningSyncRetry.disabled = true;
  await refreshSyncStatus('LEARNING_SYNC_RETRY');
  learningSyncRetry.disabled = false;
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let validationTimeout: ReturnType<typeof setTimeout> | null = null;
let lastValidInputShortcut = 'ControlLeft';
let lastValidOcrShortcut = 'ctrl-space';

function formatShortcut(shortcut: string): string {
  const labels: Record<string, string> = {
    ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải',
    ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải',
    AltLeft: 'Alt trái', AltRight: 'Alt phải',
    MetaLeft: 'Meta trái', MetaRight: 'Meta phải',
    Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Meta', Space: 'Space',
  };
  return shortcut.split('+').map((part) => {
    if (labels[part]) return labels[part];
    if (part.startsWith('Key')) return part.slice(3);
    if (part.startsWith('Digit')) return part.slice(5);
    return part.replace(/^Arrow/, '← ').replace(/^Numpad/, 'Num ');
  }).join(' + ');
}

function showInputShortcutError(message: string): void {
  inputReplacementError.textContent = message;
  inputReplacementError.classList.toggle('visible', Boolean(message));
  inputReplacementShortcut.setAttribute('aria-invalid', String(Boolean(message)));
}

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
  if (!key || !privacyConsentGranted) return false;
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
    const res = await chrome.storage.local.get(['active', 'privacyConsentGranted']);
    privacyConsentGranted = res.privacyConsentGranted === true;
    privacyConsentPanel.hidden = privacyConsentGranted;
    activeToggle.disabled = !privacyConsentGranted;
    const active = res.active !== undefined ? res.active : true;

    activeToggle.checked = privacyConsentGranted && active;
    primaryLang.value = settings.primaryTargetLang;
    secondaryLang.value = settings.secondaryTargetLang;
    reverseLang.value = settings.reverseTargetLang;
    inputReplacementEnabled.checked = settings.inputReplacementEnabled;
    inputReplacementShortcut.value = formatShortcut(settings.inputReplacementShortcut);
    inputReplacementShortcut.disabled = !settings.inputReplacementEnabled;
    lastValidInputShortcut = settings.inputReplacementShortcut;
    ocrShortcut.value = settings.ocrShortcut;
    lastValidOcrShortcut = settings.ocrShortcut;
    ocrModelTier.value = settings.ocrModelTier;
    ocrLanguage.value = settings.ocrLanguage;
    ttsToggle.checked = settings.ttsEnabled;
    providerSelect.value = settings.provider;
    deeplApiKeyInput.value = settings.deeplApiKey;
    tooltipFontSizeSelect.value = settings.tooltipFontSize;
    hanziStrokeSpeedSelect.value = String(settings.hanziStrokeSpeed);
    hanziBreakdownToggle.checked = settings.hanziBreakdownEnabled;
    hanziBreakdownLanguageSelect.value = settings.hanziBreakdownLanguage;
    ocrPinToggle.checked = settings.ocrPinImage;
    ocrCopyToggle.checked = settings.ocrCopyToClipboard;
    autoTranslateToggle.checked = settings.autoTranslate;
    phoneticsToggle.checked = settings.phoneticsVisible;

    updateDeepLContainer();
    triggerKeyValidation();
  } catch (err) {
    console.error('Failed to load settings in popup:', err);
  }
}

async function saveSettings() {
  try {
    if (inputReplacementEnabled.checked && primaryLang.value === 'none') {
      inputReplacementEnabled.checked = false;
      inputReplacementShortcut.disabled = true;
      showInputShortcutError('Chọn Primary Target trước khi bật dịch trong ô nhập.');
    }

    if (inputReplacementEnabled.checked && shortcutConflictsWithOcr(lastValidInputShortcut, ocrShortcut.value)) {
      ocrShortcut.value = lastValidOcrShortcut;
      showInputShortcutError('Phím dịch trong ô nhập trùng phím OCR. Hãy chọn phím khác.');
      return;
    }

    await chrome.storage.local.set({ active: privacyConsentGranted && activeToggle.checked });
    
    await SettingsManager.updateSettings({
      primaryTargetLang: primaryLang.value as TargetLanguage,
      secondaryTargetLang: secondaryLang.value as TargetLanguage,
      reverseTargetLang: reverseLang.value as TargetLanguage,
      inputReplacementEnabled: inputReplacementEnabled.checked,
      inputReplacementShortcut: lastValidInputShortcut,
      ocrShortcut: ocrShortcut.value as 'disabled' | 'ctrl-space' | 'alt-o' | 'ctrl-shift-o',
      ocrModelTier: ocrModelTier.value as 'tiny' | 'small' | 'medium',
      ocrLanguage: ocrLanguage.value as 'ch' | 'latin',
      ttsEnabled: ttsToggle.checked,
      provider: providerSelect.value as 'google' | 'deepl',
      deeplApiKey: deeplApiKeyInput.value,
      tooltipFontSize: tooltipFontSizeSelect.value as '12' | '14' | '16' | '18' | '20' | '24' | '28' | '32' | '36' | '40',
      hanziStrokeSpeed: Number(hanziStrokeSpeedSelect.value) as 0.5 | 1 | 1.5 | 2 | 3,
      hanziBreakdownEnabled: hanziBreakdownToggle.checked,
      hanziBreakdownLanguage: hanziBreakdownLanguageSelect.value as 'vi' | 'en',
      ocrPinImage: ocrPinToggle.checked,
      ocrCopyToClipboard: ocrCopyToggle.checked,
      autoTranslate: autoTranslateToggle.checked,
      phoneticsVisible: phoneticsToggle.checked,
    });

    lastValidOcrShortcut = ocrShortcut.value;

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

    // Notify extension pages (like the PDF viewer)
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }).catch(() => {
      // Ignore error
    });

    showStatus();
  } catch (err) {
    console.error('Failed to save settings in popup:', err);
  }
}

// Bind change events
privacyConsentAccept.addEventListener('click', async () => {
  await chrome.storage.local.set({ privacyConsentGranted: true, active: true });
  await loadSettings();
});

hanziExportBackup.addEventListener('click', async () => {
  try {
    const backup = await exportHanziLearningBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hanzi-learning-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    hanziBackupStatus.textContent = 'Hanzi backup exported';
  } catch {
    hanziBackupStatus.textContent = 'Could not export Hanzi backup';
  }
});
hanziImportBackup.addEventListener('click', () => hanziBackupFile.click());
hanziBackupFile.addEventListener('change', async () => {
  const file = hanziBackupFile.files?.[0];
  if (!file) return;
  hanziImportChoice.hidden = true;
  pendingHanziBackup = null;
  try {
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
    const backup = parseHanziLearningBackup(content);
    const summary = await inspectHanziLearningImport(backup);
    if (!summary.conflicts) {
      const applied = await importHanziLearningBackup(backup, 'keep-current');
      hanziBackupStatus.textContent = `Hanzi backup imported (${applied} items)`;
    } else {
      pendingHanziBackup = backup;
      hanziImportSummary.textContent = `${summary.additions} new items, ${summary.conflicts} conflicts. Choose which version to keep for conflicts.`;
      hanziImportChoice.hidden = false;
      hanziBackupStatus.textContent = '';
    }
  } catch {
    hanziBackupStatus.textContent = 'Invalid or unsupported Hanzi backup file';
  }
  hanziBackupFile.value = '';
});
async function finishHanziImport(choice: 'keep-current' | 'use-file'): Promise<void> {
  if (!pendingHanziBackup) return;
  try {
    const applied = await importHanziLearningBackup(pendingHanziBackup, choice);
    hanziBackupStatus.textContent = `Hanzi backup imported (${applied} items)`;
    hanziImportChoice.hidden = true;
    pendingHanziBackup = null;
  } catch {
    hanziBackupStatus.textContent = 'Could not import Hanzi backup';
  }
}
hanziImportKeepCurrent.addEventListener('click', () => void finishHanziImport('keep-current'));
hanziImportUseFile.addEventListener('click', () => void finishHanziImport('use-file'));
learningAccountLink.addEventListener('click', async () => {
  learningAccountLink.disabled = true;
  learningAccountStatus.textContent = 'Đang mở trang liên kết…';
  try {
    renderLinkStatus(await sendLinkMessage('START_ACCOUNT_LINK'));
  } catch (error) {
    learningAccountStatus.textContent = error instanceof Error ? error.message : 'Không mở được trang liên kết.';
  } finally {
    learningAccountLink.disabled = false;
  }
});
learningAccountUnlink.addEventListener('click', async () => {
  learningAccountUnlink.disabled = true;
  try {
    renderLinkStatus(await sendLinkMessage('UNLINK_ACCOUNT'));
  } catch (error) {
    learningAccountStatus.textContent = error instanceof Error ? error.message : 'Không ngắt được liên kết.';
  } finally {
    learningAccountUnlink.disabled = false;
  }
});
activeToggle.addEventListener('change', saveSettings);
primaryLang.addEventListener('change', () => {
  showInputShortcutError('');
  saveSettings();
});
secondaryLang.addEventListener('change', saveSettings);
reverseLang.addEventListener('change', saveSettings);
ocrShortcut.addEventListener('change', saveSettings);
ocrModelTier.addEventListener('change', saveSettings);
ocrLanguage.addEventListener('change', saveSettings);
ttsToggle.addEventListener('change', saveSettings);
tooltipFontSizeSelect.addEventListener('change', saveSettings);
hanziStrokeSpeedSelect.addEventListener('change', saveSettings);
hanziBreakdownToggle.addEventListener('change', saveSettings);
hanziBreakdownLanguageSelect.addEventListener('change', saveSettings);
autoTranslateToggle.addEventListener('change', saveSettings);
ocrPinToggle.addEventListener('change', saveSettings);
ocrCopyToggle.addEventListener('change', saveSettings);
phoneticsToggle.addEventListener('change', saveSettings);
inputReplacementEnabled.addEventListener('change', () => {
  inputReplacementShortcut.disabled = !inputReplacementEnabled.checked;
  showInputShortcutError('');
  saveSettings();
});

inputReplacementShortcut.addEventListener('keydown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  const shortcut = shortcutFromKeyboardEvent(event);
  if (shortcutConflictsWithOcr(shortcut, ocrShortcut.value)) {
    showInputShortcutError('Phím này trùng phím OCR. Hãy chọn phím khác.');
    inputReplacementShortcut.value = formatShortcut(lastValidInputShortcut);
    return;
  }

  lastValidInputShortcut = shortcut;
  inputReplacementShortcut.value = formatShortcut(shortcut);
  showInputShortcutError('');
  saveSettings();
});

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
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228L3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    `;
  } else {
    deeplApiKeyInput.type = 'password';
    toggleDeeplKeyBtn.innerHTML = `
      <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    `;
  }
});

// Load on startup
document.addEventListener('DOMContentLoaded', loadSettings);
loadSettings();
void refreshLinkStatus();

// Listen for storage changes to sync settings dynamically
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.learningAccountStatus?.newValue) {
    renderLinkStatus(changes.learningAccountStatus.newValue as LinkStatus);
  }
  if (areaName === 'local' && changes.settings) {
    const newSettings = changes.settings.newValue;
    if (newSettings && newSettings.phoneticsVisible !== undefined) {
      if (phoneticsToggle.checked !== newSettings.phoneticsVisible) {
        phoneticsToggle.checked = newSettings.phoneticsVisible;
      }
    }
  }
});
