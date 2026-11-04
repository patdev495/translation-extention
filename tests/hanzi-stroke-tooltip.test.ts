// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TranslationTooltip } from '../src/content/tooltip';
import { createTranslationContext, loadSettings } from '../src/content/translation-init';
import HanziWriter from 'hanzi-writer';
import woData from 'hanzi-writer-data/我.json';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function selectTextInside(element: Element, text: string): void {
  const textNode = element.firstChild!;
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: textNode,
    focusNode: textNode,
    toString: () => text,
    getRangeAt: () => ({ commonAncestorContainer: textNode }),
  } as unknown as Selection);
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
}

describe('Hanzi Stroke Order Animation in the Translation Tooltip', () => {
  test('selecting Chinese target text shows its characters beside the Chinese heading', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'tôi', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '我你', phonetics: '' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const chineseText = root.querySelector('.tt-translation-text')!;

    selectTextInside(chineseText, '我你');

    const chineseHeading = root.querySelector('.tt-lang-badge.tr1')!.parentElement!;
    const choices = chineseHeading.querySelectorAll('button[aria-pressed]');
    expect([...choices].map(choice => choice.getAttribute('aria-label'))).toEqual([
      'Loop stroke order for 我',
      'Loop stroke order for 你',
    ]);
  });

  test('clicking a character toggles its looping state independently', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'tôi', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '我你', phonetics: '' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    selectTextInside(root.querySelector('.tt-translation-text')!, '我你');
    const [wo, ni] = [...root.querySelectorAll<HTMLButtonElement>('.tt-hanzi-button')];

    wo.click();
    ni.click();
    wo.click();

    expect([wo.getAttribute('aria-pressed'), ni.getAttribute('aria-pressed')]).toEqual(['false', 'true']);
  });

  test('a selected Hanzi renders its stroke drawing from local character data', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 0));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => woData })));

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'tôi', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '我', phonetics: '' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    selectTextInside(root.querySelector('.tt-translation-text')!, '我');

    await vi.waitFor(() => {
      expect(root.querySelector('.tt-hanzi-button svg path')).not.toBeNull();
    });
    expect(fetch).toHaveBeenCalledWith('chrome-extension://test/hanzi-data/%E6%88%91.json');
  });

  test('Chinese source and reverse selections replace the displayed characters', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, '我', {
      detectedLang: 'zh',
      translations: [
        { lang: 'en', text: 'me' },
        { lang: 'zh', text: '你好' },
      ],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    selectTextInside(root.querySelector('.tt-source-text')!, '我');
    expect([...root.querySelectorAll('.tt-hanzi-button')].map(button => button.getAttribute('aria-label')))
      .toEqual(['Loop stroke order for 我']);

    selectTextInside(root.querySelectorAll('.tt-translation-text')[1], '你好');
    expect([...root.querySelectorAll('.tt-hanzi-button')].map(button => button.getAttribute('aria-label')))
      .toEqual(['Loop stroke order for 你', 'Loop stroke order for 好']);
    expect(root.querySelector('.tt-lang-badge.tr2')!.parentElement!.querySelector('.tt-hanzi-strip')).not.toBeNull();
  });

  test('clicking elsewhere preserves choices until another Chinese text selection replaces them', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'tôi', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '我你好' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const targetText = root.querySelector('.tt-translation-text')!;
    selectTextInside(targetText, '我');
    root.querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    root.querySelector('.tt-lang-badge')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    expect(root.querySelector('.tt-hanzi-button')?.getAttribute('aria-pressed')).toBe('true');

    selectTextInside(targetText, '你好');
    expect([...root.querySelectorAll('.tt-hanzi-button')].map(button => button.getAttribute('aria-pressed')))
      .toEqual(['false', 'false']);
  });

  test('a character without stroke data stays readable', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'tôi', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '我' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    selectTextInside(root.querySelector('.tt-translation-text')!, '我');

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLButtonElement>('.tt-hanzi-button')?.disabled).toBe(true);
    });
    expect(root.querySelector('.tt-hanzi-fallback')?.textContent).toBe('我');
  });

  test('dragging from Chinese text and releasing on the heading still displays the selection', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'tôi', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '我你' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const text = root.querySelector('.tt-translation-text')!;
    text.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
    const textNode = text.firstChild!;
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: textNode,
      focusNode: textNode,
      toString: () => '我你',
    } as unknown as Selection);
    root.querySelector('.tt-lang-badge.tr1')!
      .dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));

    expect(root.querySelectorAll('.tt-hanzi-button')).toHaveLength(2);
  });

  test('reads native text selection inside the tooltip Shadow DOM', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'tôi', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '我你' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const text = root.querySelector('.tt-translation-text')!;
    const textNode = text.firstChild!;
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: true,
      anchorNode: document.body,
      focusNode: document.body,
      toString: () => '我你',
    } as unknown as Selection);
    Object.defineProperty(root, 'getSelection', { configurable: true, value: () => ({
      isCollapsed: false,
      anchorNode: textNode,
      focusNode: textNode,
      toString: () => '我你',
    }) });

    text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));

    expect(root.querySelectorAll('.tt-hanzi-button')).toHaveLength(2);
  });

  test('uses the saved Hanzi stroke speed for newly selected characters', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('chrome', {
      runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
      storage: { local: { get: vi.fn(async (key: string) => key === 'settings'
        ? { settings: { hanziStrokeSpeed: 0.5 } }
        : { active: true }) } },
    });
    const createWriter = vi.spyOn(HanziWriter, 'create');
    const context = createTranslationContext();
    await loadSettings(context);
    context.tooltip.show(0, 0, 'tôi', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '我' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    selectTextInside(root.querySelector('.tt-translation-text')!, '我');

    expect(createWriter).toHaveBeenCalledWith(expect.anything(), '我',
      expect.objectContaining({ strokeAnimationSpeed: 0.5 }));
  });

  test('selecting one Hanzi makes only its glyph and Pinyin syllable bold', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });

    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'like', {
      detectedLang: 'en',
      translations: [{ lang: 'zh', text: '喜欢', phonetics: '喜欢 xǐ huan' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const text = root.querySelector('.tt-translation-text')!;
    const range = document.createRange();
    range.setStart(text.firstChild!, 0);
    range.setEnd(text.firstChild!, 1);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: text.firstChild,
      focusNode: text.firstChild,
      toString: () => range.toString(),
      getRangeAt: () => range,
    } as unknown as Selection);

    text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));

    expect([...text.querySelectorAll('.tt-reading-focus')].map(node => node.textContent)).toEqual(['喜']);
    expect([...root.querySelectorAll('.tt-phonetic .tt-reading-focus')].map(node => node.textContent))
      .toEqual(['喜', 'xǐ']);
    expect(window.getSelection()?.toString()).toBe('喜');
  });

  test('selecting the second repeated English word makes its matching IPA group bold', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'Home home', {
      detectedLang: 'en',
      sourcePhonetics: 'Home hoʊm · home hoʊm',
      translations: [],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const text = root.querySelector('.tt-source-text')!;
    const range = document.createRange();
    range.setStart(text.firstChild!, 5);
    range.setEnd(text.firstChild!, 9);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: text.firstChild,
      focusNode: text.firstChild,
      toString: () => 'home',
      getRangeAt: () => range,
    } as unknown as Selection);

    text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));

    expect([...text.querySelectorAll('.tt-reading-focus')].map(node => node.textContent)).toEqual(['home']);
    expect([...root.querySelectorAll('.tt-phonetic .tt-reading-focus')].map(node => node.textContent))
      .toEqual(['home hoʊm']);
  });

  test('selecting several Hanzi replaces the previous focus with every selected character and syllable', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'like', {
      detectedLang: 'en',
      translations: [{ lang: 'zh', text: '喜欢', phonetics: '喜欢 xǐ huan' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const text = root.querySelector('.tt-translation-text')!;
    const one = document.createRange();
    one.setStart(text.firstChild!, 0);
    one.setEnd(text.firstChild!, 1);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false, rangeCount: 1,
      anchorNode: text.firstChild, focusNode: text.firstChild,
      toString: () => one.toString(), getRangeAt: () => one,
    } as unknown as Selection);
    text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    expect(root.querySelectorAll('.tt-reading-focus')).toHaveLength(3);

    const many = document.createRange();
    many.selectNodeContents(text);
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false, rangeCount: 1,
      anchorNode: text, focusNode: text,
      toString: () => many.toString(), getRangeAt: () => many,
    } as unknown as Selection);
    text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));

    expect([...text.querySelectorAll('.tt-reading-focus')].map(node => node.textContent)).toEqual(['喜', '欢']);
    expect([...root.querySelectorAll('.tt-phonetic .tt-reading-focus')].map(node => node.textContent))
      .toEqual(['喜', '欢', 'xǐ', 'huan']);
    expect(root.querySelectorAll('.tt-hanzi-button')).toHaveLength(2);
  });
});
