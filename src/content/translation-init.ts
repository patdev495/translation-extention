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
    if (ctx.settings) {
      ctx.tooltip.updateHanziStrokeSpeed(ctx.settings.hanziStrokeSpeed);
      ctx.tooltip.updateHanziBreakdownSettings(ctx.settings.hanziBreakdownEnabled, ctx.settings.hanziBreakdownLanguage);
    }
    if (ctx.settings && ctx.settings.phoneticsVisible !== undefined) {
      ctx.tooltip.updatePhoneticsVisibility(ctx.settings.phoneticsVisible);
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

/**
 * Sends a translation request to the service worker and shows the tooltip.
 */
export function performTranslation(ctx: TranslationContext, text: string, x: number, y: number, ocrWidth?: number): void {
  if (!ctx.settings) return;

  chrome.runtime.sendMessage(
    { type: 'TRANSLATE', text },
    (response) => {
      if (response && response.success) {
        ctx.tooltip.show(
          x,
          y - 8,
          text,
          response.data,
          ctx.settings?.ttsEnabled ?? true,
          ctx.settings?.phoneticsVisible ?? true,
          ocrWidth
        );
      } else {
        console.error('Translation error:', response?.error);
      }
    }
  );
}

/** Shadow DOM descendants are not covered by Element.contains on the host. */
export function isSelectionInsideTooltip(selection: Selection, root: Element | null): boolean {
  if (!root) return false;
  const inside = (node: Node | null) => !!node &&
    (root.contains(node) || !!root.shadowRoot?.contains(node));
  return inside(selection.anchorNode) || inside(selection.focusNode)
    || (selection.rangeCount > 0 && inside(selection.getRangeAt(0).commonAncestorContainer));
}

/** Translates the current page selection when the user invokes the shortcut. */
export function translateSelectedPageText(ctx: TranslationContext): boolean {
  if (!ctx.active || !ctx.settings) return false;
  const focused = document.activeElement;
  if ((focused && 'isContentEditable' in focused && focused.isContentEditable)
    || focused?.nodeName === 'INPUT' || focused?.nodeName === 'TEXTAREA') return false;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

  const text = selection.toString().trim();
  if (!text) return false;

  const root = document.getElementById('translation-extension-root');
  const breakdownRoot = document.getElementById('translation-extension-hanzi-breakdown-root');
  const range = selection.getRangeAt(0);
  if (isSelectionInsideTooltip(selection, root) || isSelectionInsideTooltip(selection, breakdownRoot)) return false;

  const rect = range.getBoundingClientRect();
  const x = rect.left + window.scrollX;
  const y = rect.bottom + window.scrollY;
  ctx.lastSelection = { text, x, y };
  performTranslation(ctx, text, x, y);
  return true;
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
    const breakdownRoot = document.getElementById('translation-extension-hanzi-breakdown-root');
    const path = event.composedPath();
    const isInsideRoot = (!!root && path.includes(root)) || (!!breakdownRoot && path.includes(breakdownRoot));
    if (isInsideRoot) return;

    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const selectedText = selection.toString().trim();
      if (selectedText.length === 0) return;

      if (isSelectionInsideTooltip(selection, root) || isSelectionInsideTooltip(selection, breakdownRoot)) return;

      ctx.lastSelection = { text: selectedText, x, y };
      performTranslation(ctx, selectedText, x, y);
    }, 10);
  });

  // Mousedown: hide tooltip unless clicking inside it
  target.addEventListener('mousedown', (e) => {
    const event = e as MouseEvent;
    const root = document.getElementById('translation-extension-root');
    const breakdownRoot = document.getElementById('translation-extension-hanzi-breakdown-root');
    const path = event.composedPath();
    const isInsideRoot = (!!root && path.includes(root)) || (!!breakdownRoot && path.includes(breakdownRoot));
    if (isInsideRoot) return;

    const isInsidePinned = event.composedPath().some(node => 
      node instanceof HTMLElement && node.classList.contains('polytranslate-pinned-wrapper')
    );
    if (isInsidePinned) return;

    ctx.tooltip.hide();
    ctx.tooltip.hideTrigger();
  });
}

