// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TranslationTooltip } from '../src/content/tooltip';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function selectWithin(element: Element, start: number, end: number): Selection {
  const locate = (offset: number): { node: Text; offset: number } => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (offset <= node.length) return { node, offset };
      offset -= node.length;
    }
    throw new Error('Selection offset outside element');
  };
  const first = locate(start);
  const last = locate(end);
  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset);
  const selection = {
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: first.node,
    focusNode: last.node,
    getRangeAt: () => range,
    toString: () => range.toString(),
  } as unknown as Selection;
  vi.spyOn(window, 'getSelection').mockReturnValue(selection);
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  return selection;
}

describe('Reading Focus in the Translation Tooltip', () => {
  test('selecting a Chinese phrase bolds its characters and both Pinyin syllables', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'Một mẹo:', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '一点提示:', phonetics: '一点 yì diǎn · 提示 tí shì:' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const text = root.querySelector('.tt-translation-text')!;

    const selection = selectWithin(text, 0, 2);

    expect([...text.querySelectorAll('.tt-reading-focus')].map(node => node.textContent).join('')).toBe('一点');
    expect([...root.querySelectorAll('.tt-phonetic .tt-reading-focus')].map(node => node.textContent).join(''))
      .toBe('一点yìdiǎn');
    expect(selection.toString()).toBe('一点');
    expect(root.querySelectorAll('.tt-hanzi-button')).toHaveLength(2);
  });

  test('selecting one Pinyin syllable focuses its Chinese character in both rows', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'Một mẹo:', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '一点提示:', phonetics: '一点 yì diǎn · 提示 tí shì:' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const phonetic = root.querySelector('.tt-phonetic')!;
    const start = phonetic.textContent!.indexOf('diǎn');
    const selection = selectWithin(phonetic, start, start + 'diǎn'.length);

    expect([...root.querySelectorAll('.tt-translation-text .tt-reading-focus')].map(node => node.textContent)).toEqual(['点']);
    expect([...phonetic.querySelectorAll('.tt-reading-focus')].map(node => node.textContent)).toEqual(['点', 'diǎn']);
    expect(selection.toString()).toBe('diǎn');
  });

  test('selecting Pinyin replaces previously displayed stroke drawings with its corresponding Hanzi', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'Một mẹo:', {
      detectedLang: 'vi',
      translations: [{ lang: 'zh', text: '一点提示:', phonetics: '一点 yì diǎn · 提示 tí shì:' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    selectWithin(root.querySelector('.tt-translation-text')!, 0, 2);
    expect(root.querySelectorAll('.tt-hanzi-button')).toHaveLength(2);

    const phonetic = root.querySelector('.tt-phonetic')!;
    const start = phonetic.textContent!.indexOf('diǎn');
    const selection = selectWithin(phonetic, start, start + 'diǎn'.length);

    expect([...root.querySelectorAll('.tt-hanzi-button')].map(button => button.getAttribute('aria-label')))
      .toEqual(['Loop stroke order for 点']);
    expect(selection.toString()).toBe('diǎn');
  });

  test('selecting several Pinyin syllables in a Chinese source displays each matching stroke drawing', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, '你好', {
      detectedLang: 'zh',
      sourcePhonetics: '你好 nǐ hǎo',
      translations: [{ lang: 'en', text: 'hello' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const phonetic = root.querySelector('.tt-phonetic.src')!;
    const start = phonetic.textContent!.indexOf('nǐ');
    selectWithin(phonetic, start, start + 'nǐ hǎo'.length);

    expect([...root.querySelectorAll('.tt-hanzi-button')].map(button => button.getAttribute('aria-label')))
      .toEqual(['Loop stroke order for 你', 'Loop stroke order for 好']);
    expect(root.querySelector('.tt-lang-badge.src')!.parentElement!.querySelector('.tt-hanzi-strip')).not.toBeNull();
  });

  test('selecting IPA in an English source focuses only the matching repeated word', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    const tooltip = new TranslationTooltip();
    tooltip.show(0, 0, 'Home home', {
      detectedLang: 'en',
      sourcePhonetics: 'Home hoʊm · home hoʊm',
      translations: [{ lang: 'vi', text: 'Nhà nhà' }],
    });
    const root = document.getElementById('translation-extension-root')!.shadowRoot!;
    const phonetic = root.querySelector('.tt-phonetic')!;
    const start = phonetic.textContent!.lastIndexOf('hoʊm');
    selectWithin(phonetic, start, start + 'hoʊm'.length);

    expect([...root.querySelectorAll('.tt-source-text .tt-reading-focus')].map(node => node.textContent)).toEqual(['home']);
    expect([...phonetic.querySelectorAll('.tt-reading-focus')].map(node => node.textContent)).toEqual(['home hoʊm']);
    expect(root.querySelector('.tt-lang-badge.src')?.textContent).toBe('English');
  });
});
