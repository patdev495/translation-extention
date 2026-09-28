import type { TargetLanguage } from './translation-plan';

export interface Settings {
  primaryTargetLang: TargetLanguage;
  secondaryTargetLang: TargetLanguage;
  reverseTargetLang: TargetLanguage;
  inputReplacementEnabled: boolean;
  inputReplacementShortcut: string;
  ocrShortcut: 'disabled' | 'ctrl-space' | 'alt-o' | 'ctrl-shift-o';
  ocrModelTier: 'tiny' | 'small' | 'medium';
  ocrLanguage: 'ch' | 'latin';
  ttsEnabled: boolean;
  provider: 'google' | 'deepl';
  deeplApiKey: string;
  tooltipFontSize: '12' | '14' | '16' | '18' | '20' | '24' | '28' | '32' | '36' | '40' | '48' | '56' | '64' | '72' | '80';
  ocrPinImage: boolean;
  ocrCopyToClipboard: boolean;
  autoTranslate: boolean;
  phoneticsVisible: boolean;
}

export class SettingsManager {
  static readonly DEFAULT_SETTINGS: Settings = {
    primaryTargetLang: 'vi',
    secondaryTargetLang: 'zh',
    reverseTargetLang: 'en',
    inputReplacementEnabled: true,
    inputReplacementShortcut: 'ControlLeft',
    ocrShortcut: 'ctrl-space',
    ocrModelTier: 'medium',
    ocrLanguage: 'latin',
    ttsEnabled: true,
    provider: 'google',
    deeplApiKey: '',
    tooltipFontSize: '16',
    ocrPinImage: false,
    ocrCopyToClipboard: true,
    autoTranslate: true,
    phoneticsVisible: true,
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
