import type { TargetLanguage } from './translation-plan';

export interface Settings {
  primaryTargetLang: TargetLanguage;
  secondaryTargetLang: TargetLanguage;
  reverseTargetLang: TargetLanguage;
  hotkey: 'none' | 'ctrl' | 'alt' | 'shift';
  ocrShortcut: 'disabled' | 'ctrl-space' | 'alt-o' | 'ctrl-shift-o';
  ocrModelTier: 'tiny' | 'small' | 'medium';
  ocrLanguage: 'ch' | 'latin';
  ttsEnabled: boolean;
  provider: 'google' | 'deepl';
  deeplApiKey: string;
}

export class SettingsManager {
  static readonly DEFAULT_SETTINGS: Settings = {
    primaryTargetLang: 'vi',
    secondaryTargetLang: 'en',
    reverseTargetLang: 'zh',
    hotkey: 'none',
    ocrShortcut: 'ctrl-space',
    ocrModelTier: 'small',
    ocrLanguage: 'ch',
    ttsEnabled: true,
    provider: 'google',
    deeplApiKey: '',
  };

  static async getSettings(): Promise<Settings> {
    const result = await chrome.storage.local.get('settings');
    if (result && result.settings) {
      return { ...this.DEFAULT_SETTINGS, ...result.settings };
    }
    return this.DEFAULT_SETTINGS;
  }

  static async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await chrome.storage.local.set({ settings: updated });
    return updated;
  }
}
