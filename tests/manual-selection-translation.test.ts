import { afterEach, describe, expect, test, vi } from 'vitest';
import { InputReplacementShortcutTracker } from '../src/content/input-replacement-shortcut';
import { isSelectionInsideTooltip, translateSelectedPageText, type TranslationContext } from '../src/content/translation-init';
import { SettingsManager } from '../src/services/settings';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('manual selection translation', () => {
  test('Ctrl translates selected page text with Auto Translate disabled', () => {
    const tracker = new InputReplacementShortcutTracker('ControlLeft');
    const context = {
      active: true,
      settings: { ...SettingsManager.DEFAULT_SETTINGS, autoTranslate: false },
      lastSelection: { text: '', x: 0, y: 0 },
      tooltip: { show: vi.fn() },
    } as unknown as TranslationContext;
    const range = {
      commonAncestorContainer: {},
      getBoundingClientRect: () => ({ left: 20, bottom: 40 }),
    };
    const selection = {
      rangeCount: 1,
      isCollapsed: false,
      toString: () => ' hello ',
      getRangeAt: () => range,
    };
    const sendMessage = vi.fn((_message, callback) => callback({ success: true, data: {} }));
    vi.stubGlobal('window', { getSelection: () => selection, scrollX: 5, scrollY: 10 });
    vi.stubGlobal('document', { getElementById: () => null });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });

    tracker.handleKeyDown({ code: 'ControlLeft' } as KeyboardEvent);
    expect(tracker.handleKeyUp({ code: 'ControlLeft' } as KeyboardEvent)).toBe(true);
    expect(translateSelectedPageText(context)).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({ type: 'TRANSLATE', text: 'hello' }, expect.any(Function));
    expect(context.lastSelection).toEqual({ text: 'hello', x: 25, y: 50 });
    expect(context.tooltip.show).toHaveBeenCalledOnce();
  });

  test('ignores an empty selection', () => {
    vi.stubGlobal('window', { getSelection: () => null });
    vi.stubGlobal('document', { activeElement: null });
    const context = {
      active: true,
      settings: { ...SettingsManager.DEFAULT_SETTINGS, autoTranslate: false },
    } as TranslationContext;
    expect(translateSelectedPageText(context)).toBe(false);
  });

  test('ignores text selected inside the tooltip Shadow DOM', () => {
    const tooltipText = {} as Node;
    const root = {
      contains: () => false,
      shadowRoot: { contains: (node: Node) => node === tooltipText },
    } as unknown as Element;
    const selection = {
      anchorNode: tooltipText,
      focusNode: tooltipText,
      rangeCount: 1,
      isCollapsed: false,
      toString: () => 'tooltip text',
      getRangeAt: () => ({ commonAncestorContainer: tooltipText }),
    } as unknown as Selection;
    const sendMessage = vi.fn();
    vi.stubGlobal('window', { getSelection: () => selection });
    vi.stubGlobal('document', { activeElement: null, getElementById: () => root });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    const context = {
      active: true,
      settings: { ...SettingsManager.DEFAULT_SETTINGS, autoTranslate: false },
    } as TranslationContext;

    expect(isSelectionInsideTooltip(selection, root)).toBe(true);
    expect(translateSelectedPageText(context)).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
