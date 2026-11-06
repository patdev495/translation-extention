// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { SettingsManager } from '../src/services/settings';

const overlayState = vi.hoisted(() => ({ onSelectionComplete: null as null | ((rect: any) => Promise<void>) }));
vi.mock('../src/content/ocr-selection-overlay', () => ({
  OcrSelectionOverlay: class {
    constructor(_root: Element, options: { onSelectionComplete: (rect: any) => Promise<void> }) {
      overlayState.onSelectionComplete = options.onSelectionComplete;
    }
    start() {}
    stop() {}
    showProgress() {}
    updateProgressText() {}
  },
}));

import { toggleWebpageOcr } from '../src/content/ocr-selection';
import type { TranslationContext } from '../src/content/translation-init';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('an OCR image region opens its translation tooltip when Auto Translate is off', async () => {
  const show = vi.fn();
  const sendMessage = vi.fn((message: { type: string }, callback: (value: any) => void) => {
    if (message.type === 'CAPTURE_TAB') callback({ success: true, data: { text: '你好', croppedDataUrl: '' } });
    if (message.type === 'TRANSLATE') callback({ success: true, data: { detectedLang: 'zh', translations: [] } });
  });
  vi.stubGlobal('chrome', { runtime: {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() }, sendMessage,
  } });
  const ctx = {
    active: true,
    settings: { ...SettingsManager.DEFAULT_SETTINGS, autoTranslate: false, ocrPinImage: false, ocrCopyToClipboard: false },
    tooltip: { setPointerPassthrough: vi.fn(), show },
  } as unknown as TranslationContext;

  toggleWebpageOcr(ctx);
  await overlayState.onSelectionComplete!({ left: 10, top: 20, width: 100, height: 40 });

  expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'TRANSLATE', text: '你好' }), expect.any(Function));
  expect(show).toHaveBeenCalledWith(60, 12, '你好', expect.any(Object), expect.any(Boolean), expect.any(Boolean), 100);
});
