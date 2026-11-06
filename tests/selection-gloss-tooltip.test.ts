// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { TranslationTooltip } from '../src/content/tooltip';

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('selecting a Chinese phrase adds bold parenthesized meanings to the other displayed languages', async () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const sendMessage = vi.fn((message, callback) => {
    if (message.type === 'TRANSLATE_SELECTION') callback(message.targetLang === 'vi'
      ? { success: true, translation: 'không mở' }
      : { success: true, translation: 'cannot open', phonetics: 'cannot ˈkænɑt · open ˈoʊpən' });
  });
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => path, sendMessage } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, '但打不开', { detectedLang: 'zh', sourcePhonetics: '但 dàn · 打不开 dǎ bù kāi', translations: [
    { lang: 'vi', text: 'Nhưng không thể mở' }, { lang: 'en', text: 'But it cannot be opened' },
  ] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const source = root.querySelector('.tt-source-text')!;
  const node = source.firstChild!;
  const range = document.createRange(); range.setStart(node, 2); range.setEnd(node, 4);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, rangeCount: 1, anchorNode: node, focusNode: node, getRangeAt: () => range, toString: () => range.toString() } as unknown as Selection);
  source.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  await vi.waitFor(() => expect(root.querySelectorAll('.tt-selection-gloss')).toHaveLength(2));
  expect(sendMessage).toHaveBeenCalledWith({ type: 'TRANSLATE_SELECTION', text: '不开', targetLang: 'vi' }, expect.any(Function));
  expect(sendMessage).toHaveBeenCalledWith({ type: 'TRANSLATE_SELECTION', text: '不开', targetLang: 'en' }, expect.any(Function));
  const vietnamese = root.querySelector('.tt-section[data-lang="vi"]')!;
  const english = root.querySelector('.tt-section[data-lang="en"]')!;
  expect(vietnamese.querySelector('.tt-selection-gloss')?.textContent).toBe('(không mở)');
  expect(vietnamese.querySelector('.tt-selection-gloss strong')?.textContent).toBe('không mở');
  expect(english.querySelector('.tt-selection-gloss')?.textContent).toContain('cannot open');
  expect(english.querySelector('.tt-selection-gloss')?.textContent).toContain('ˈoʊpən');
  expect(source.textContent).toBe('但打不开');
  expect(vietnamese.querySelector('.tt-translation-text')?.textContent).toBe('Nhưng không thể mở');
});

test('selecting an English word shows Pinyin with Chinese gloss and no phonetics with Vietnamese gloss', async () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  const sendMessage = vi.fn((message, callback) => {
    if (message.type === 'TRANSLATE_SELECTION') callback(message.targetLang === 'zh'
      ? { success: true, translation: '打开', phonetics: 'dǎ kāi' }
      : { success: true, translation: 'mở' });
  });
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => path, sendMessage } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, 'Open the door', { detectedLang: 'en', translations: [
    { lang: 'zh', text: '打开门' }, { lang: 'vi', text: 'Mở cửa' },
  ] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const source = root.querySelector('.tt-source-text')!;
  const node = source.firstChild!;
  const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 4);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, rangeCount: 1, anchorNode: node, focusNode: node, getRangeAt: () => range, toString: () => range.toString() } as unknown as Selection);
  source.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  await vi.waitFor(() => expect(root.querySelectorAll('.tt-selection-gloss')).toHaveLength(2));
  expect(root.querySelector('.tt-section[data-lang="zh"] .tt-selection-gloss')?.textContent).toBe('(打开 · dǎ kāi)');
  expect(root.querySelector('.tt-section[data-lang="vi"] .tt-selection-gloss')?.textContent).toBe('(mở)');
});

test('selecting a Vietnamese word highlights it and shows Chinese and English meanings with pronunciation', async () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  const sendMessage = vi.fn((message, callback) => {
    if (message.type === 'TRANSLATE_SELECTION') callback(message.targetLang === 'zh'
      ? { success: true, translation: '打开', phonetics: 'dǎ kāi' }
      : { success: true, translation: 'open', phonetics: 'open ˈoʊpən' });
  });
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => path, sendMessage } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, 'Mở cửa ra', { detectedLang: 'vi', translations: [
    { lang: 'zh', text: '打开门' }, { lang: 'en', text: 'Open the door' },
  ] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const source = root.querySelector('.tt-source-text')!;
  const node = source.firstChild!;
  const range = document.createRange(); range.setStart(node, 0); range.setEnd(node, 2);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, rangeCount: 1, anchorNode: node, focusNode: node, getRangeAt: () => range, toString: () => range.toString() } as unknown as Selection);
  source.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  await vi.waitFor(() => expect(root.querySelectorAll('.tt-selection-gloss')).toHaveLength(2));
  expect(source.querySelector('.tt-reading-focus')?.textContent).toBe('Mở');
  expect(sendMessage).toHaveBeenCalledWith({ type: 'TRANSLATE_SELECTION', text: 'Mở', targetLang: 'zh' }, expect.any(Function));
  expect(sendMessage).toHaveBeenCalledWith({ type: 'TRANSLATE_SELECTION', text: 'Mở', targetLang: 'en' }, expect.any(Function));
  expect(root.querySelector('.tt-section[data-lang="zh"] .tt-selection-gloss')?.textContent).toBe('(打开 · dǎ kāi)');
  expect(root.querySelector('.tt-section[data-lang="en"] .tt-selection-gloss')?.textContent).toBe('(open · ˈoʊpən)');
});

test('Pinyin selection requests its Chinese phrase and old translation cannot change a new tooltip', async () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const replies: Array<(response: object) => void> = [];
  const sendMessage = vi.fn((_message, callback) => { replies.push(callback); });
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => path, sendMessage } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, '但打不开', { detectedLang: 'zh', sourcePhonetics: '但 dàn · 打不开 dǎ bù kāi', translations: [{ lang: 'vi', text: 'Nhưng không thể mở' }] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const phonetic = root.querySelector('.tt-phonetic')!;
  const node = phonetic.firstChild!;
  const start = node.textContent!.indexOf('bù kāi');
  const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + 'bù kāi'.length);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, rangeCount: 1, anchorNode: node, focusNode: node, getRangeAt: () => range, toString: () => range.toString() } as unknown as Selection);
  phonetic.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  expect(sendMessage).toHaveBeenCalledWith({ type: 'TRANSLATE_SELECTION', text: '不开', targetLang: 'vi' }, expect.any(Function));
  tooltip.show(0, 0, '谢谢', { detectedLang: 'zh', translations: [{ lang: 'vi', text: 'Cảm ơn' }] });
  replies[0]!({ success: true, translation: 'không mở' });
  await Promise.resolve();
  expect(root.querySelector('.tt-selection-gloss')).toBeNull();
});
