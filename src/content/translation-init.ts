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
 * Returns true if the configured hotkey modifier is held during a mouse event.
 */
export function isHotkeyMatched(ctx: TranslationContext, event: MouseEvent): boolean {
  if (!ctx.settings) return true;
  switch (ctx.settings.hotkey) {
    case 'ctrl':  return event.ctrlKey;
    case 'alt':   return event.altKey;
    case 'shift': return event.shiftKey;
    case 'none':
    default:      return true;
  }
}

/**
 * Returns true if the keyboard event matches the configured hotkey.
 */
export function matchesHotkey(ctx: TranslationContext, event: KeyboardEvent): boolean {
  if (!ctx.settings) return false;
  switch (ctx.settings.hotkey) {
    case 'ctrl':  return event.key === 'Control';
    case 'alt':   return event.key === 'Alt';
    case 'shift': return event.key === 'Shift';
    default:      return false;
  }
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
 * Attaches all translation event listeners (mouseup, mousedown, keydown) to a target element.
 * Works on both `document` (web) and the PDF viewer container.
 */
export function initTranslationListeners(
  ctx: TranslationContext,
  target: EventTarget = document
): void {
  // Keydown: trigger via hotkey press on existing selection
  target.addEventListener('keydown', (e) => {
    const event = e as KeyboardEvent;
    if (!ctx.active || !ctx.settings || event.repeat) return;

    if (matchesHotkey(ctx, event)) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const selectedText = selection.toString().trim();
      if (selectedText.length === 0) return;

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const x = rect.left + window.scrollX + (rect.width / 2);
      const y = rect.top + window.scrollY;

      ctx.lastSelection = { text: selectedText, x, y };
      performTranslation(ctx, selectedText, x, y);
    }
  });

  // Mouseup: selection tracking + trigger mode logic
  target.addEventListener('mouseup', (e) => {
    const event = e as MouseEvent;
    const currentSettings = ctx.settings;
    if (!ctx.active || !currentSettings) return;

    const x = event.pageX;
    const y = event.pageY;
    const isHotkeyHeld = isHotkeyMatched(ctx, event);
    const root = document.getElementById('translation-extension-root');
    const isInsideRoot = root ? (event as any).composedPath().includes(root) : false;

    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const selectedText = selection.toString().trim();
      if (selectedText.length === 0) return;

      if (isInsideRoot) return;

      ctx.lastSelection = { text: selectedText, x, y };

      if (currentSettings.hotkey === 'none') {
        performTranslation(ctx, selectedText, x, y);
      } else {
        if (isHotkeyHeld) {
          performTranslation(ctx, selectedText, x, y);
        } else {
          ctx.tooltip.showTrigger(x, y - 8);
        }
      }
    }, 10);
  });

  // Mousedown: hide tooltip unless clicking inside it
  target.addEventListener('mousedown', (e) => {
    const event = e as MouseEvent;
    const root = document.getElementById('translation-extension-root');
    const isInsideRoot = root ? (event as any).composedPath().includes(root) : false;
    if (isInsideRoot) return;

    ctx.tooltip.hide();
    ctx.tooltip.hideTrigger();
  });

  // Trigger button click handler
  ctx.tooltip.onTriggerClick = () => {
    if (!ctx.settings) return;
    performTranslation(ctx, ctx.lastSelection.text, ctx.lastSelection.x, ctx.lastSelection.y);
  };
}
