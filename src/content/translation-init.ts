import { TranslationTooltip } from './tooltip';
import { SettingsManager, Settings } from '../services/settings';

export interface TranslationContext {
  tooltip: TranslationTooltip;
  settings: Settings | null;
  active: boolean;
  lastSelection: { text: string; x: number; y: number };
}

/**
 * Creates and returns a TranslationContext with a mounted tooltip.
 */
export function createTranslationContext(): TranslationContext {
  return {
    tooltip: new TranslationTooltip(),
    settings: null,
    active: true,
    lastSelection: { text: '', x: 0, y: 0 },
  };
}

/**
 * Loads settings and active state from storage into the context.
 */
export async function loadSettings(ctx: TranslationContext): Promise<void> {
  try {
    ctx.settings = await SettingsManager.getSettings();
    const res = await chrome.storage.local.get('active');
    ctx.active = res.active !== undefined ? res.active : true;
    if (ctx.settings && ctx.settings.tooltipFontSize) {
      ctx.tooltip.updateFontSize(ctx.settings.tooltipFontSize);
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

/**
 * Sends a translation request to the service worker and shows the tooltip.
 */
export function performTranslation(ctx: TranslationContext, text: string, x: number, y: number): void {
  if (!ctx.settings) return;

  chrome.runtime.sendMessage(
    { type: 'TRANSLATE', text },
    (response) => {
      if (response && response.success) {
        ctx.tooltip.show(x, y - 8, text, response.data, ctx.settings?.ttsEnabled ?? true);
      } else {
        console.error('Translation error:', response?.error);
      }
    }
  );
}

/**
 * Returns true if the keyboard event matches the configured OCR Shortcut settings.
 */
export function matchesOcrShortcut(ctx: TranslationContext, event: KeyboardEvent): boolean {
  const shortcut = ctx.settings?.ocrShortcut ?? 'ctrl-space';
  if (shortcut === 'disabled') return false;

  const key = event.key.toLowerCase();
  if (shortcut === 'ctrl-space') {
    return event.ctrlKey && !event.altKey && !event.shiftKey && event.code === 'Space';
  }
  if (shortcut === 'alt-o') {
    return event.altKey && !event.ctrlKey && !event.shiftKey && key === 'o';
  }
  if (shortcut === 'ctrl-shift-o') {
    return event.ctrlKey && event.shiftKey && !event.altKey && key === 'o';
  }
  return false;
}

/**
 * Attaches all translation event listeners (mouseup, mousedown) to a target element.
 * Works on both `document` (web) and the PDF viewer container.
 */
export function initTranslationListeners(
  ctx: TranslationContext,
  target: EventTarget = document
): void {
  // Mouseup: selection tracking + auto translation logic
  target.addEventListener('mouseup', (e) => {
    const event = e as MouseEvent;
    const currentSettings = ctx.settings;
    if (!ctx.active || !currentSettings || !currentSettings.autoTranslate) return;

    const isInsidePinned = event.composedPath().some(node => 
      node instanceof HTMLElement && node.classList.contains('polytranslate-pinned-wrapper')
    );
    if (isInsidePinned) return;

    const x = event.pageX;
    const y = event.pageY;
    const root = document.getElementById('translation-extension-root');
    const isInsideRoot = root ? (event as any).composedPath().includes(root) : false;

    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const selectedText = selection.toString().trim();
      if (selectedText.length === 0) return;

      if (isInsideRoot) return;

      ctx.lastSelection = { text: selectedText, x, y };
      performTranslation(ctx, selectedText, x, y);
    }, 10);
  });

  // Mousedown: hide tooltip unless clicking inside it
  target.addEventListener('mousedown', (e) => {
    const event = e as MouseEvent;
    const root = document.getElementById('translation-extension-root');
    const isInsideRoot = root ? (event as any).composedPath().includes(root) : false;
    if (isInsideRoot) return;

    const isInsidePinned = event.composedPath().some(node => 
      node instanceof HTMLElement && node.classList.contains('polytranslate-pinned-wrapper')
    );
    if (isInsidePinned) return;

    ctx.tooltip.hide();
    ctx.tooltip.hideTrigger();
  });
}

