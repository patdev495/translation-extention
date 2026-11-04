// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { TranslationTooltip } from '../src/content/tooltip';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('normal and OCR tooltips have a 350px content floor while wider OCR regions keep their width', () => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  const tooltip = new TranslationTooltip();
  const data = { detectedLang: 'en', translations: [{ lang: 'vi', text: 'nhà' }] };
  const body = () => document.getElementById('translation-extension-root')!.shadowRoot!
    .querySelector<HTMLElement>('.tt-body')!;

  tooltip.show(0, 0, 'home', data);
  expect(body().style.minWidth).toBe('min(350px, 960px)');

  tooltip.show(0, 0, 'home', data, true, true, 120);
  expect(body().style.minWidth).toBe('min(350px, 960px)');

  tooltip.show(0, 0, 'home', data, true, true, 480);
  expect(body().style.minWidth).toBe('min(480px, 960px)');
});
