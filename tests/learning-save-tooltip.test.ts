// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { TranslationTooltip } from '../src/content/tooltip';

afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('Chinese row button and s expose same category choices; typing does not trigger shortcuts', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn((_message, callback) => callback({ success: true, result: [{ id: 'one', name: 'HSK' }] })) }, storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) } } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, 'hello', { detectedLang: 'en', translations: [{ lang: 'zh', text: '你好', phonetics: 'nǐ hǎo' }] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  expect(root.querySelectorAll('.tt-save-button')).toHaveLength(1);
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  expect(root.querySelectorAll('.tt-save-choice')).toHaveLength(2);
  expect(root.querySelector('.tt-save-choice[data-choice="both"]')).toBeNull();
  root.querySelector<HTMLButtonElement>('.tt-save-close')!.click();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
  expect(root.querySelectorAll('.tt-save-choice')).toHaveLength(2);
  const input = document.createElement('input'); document.body.append(input); input.focus();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
  expect(root.querySelector('.tt-save-form')).toBeNull();
});

test('Chinese Save Selection keeps highlighted phrase and previews containing sentence', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn((_message, callback) => callback({ success: true, result: [{ id: 'one', name: 'HSK' }] })) }, storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) } } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, '我喜欢学习中文。你呢？', { detectedLang: 'zh', translations: [{ lang: 'en', text: 'I like learning Chinese. And you?' }] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const text = root.querySelector('.tt-source-text')!.firstChild!;
  const range = document.createRange(); range.setStart(text, 3); range.setEnd(text, 5);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, rangeCount: 1, getRangeAt: () => range, toString: () => '学习' } as unknown as Selection);
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  expect(root.querySelectorAll('.tt-save-choice')).toHaveLength(3);
  root.querySelector<HTMLButtonElement>('[data-choice="both"]')!.click();
  expect((root.querySelector('.tt-save-text') as HTMLInputElement).value).toBe('学习');
  expect((root.querySelector('.tt-save-sentence') as HTMLTextAreaElement).value).toBe('我喜欢学习中文。');
});

test('selection survives Reading Focus and clicking Save after browser clears live selection', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => path, sendMessage: vi.fn((_message, callback) => callback({ success: false })) } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, 'Lời khuyên', { detectedLang: 'vi', translations: [{ lang: 'zh', text: '建议', phonetics: '建议 jiàn yì' }] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const text = root.querySelector('.tt-translation-text')!.firstChild!;
  const range = document.createRange(); range.setStart(text, 1); range.setEnd(text, 2);
  const selected = { isCollapsed: false, rangeCount: 1, anchorNode: text, focusNode: text, getRangeAt: () => range, toString: () => '议' } as unknown as Selection;
  const live = vi.spyOn(window, 'getSelection').mockReturnValue(selected);
  text.parentElement!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  live.mockReturnValue({ isCollapsed: true, rangeCount: 0, toString: () => '' } as unknown as Selection);
  const button = root.querySelector<HTMLButtonElement>('.tt-save-button')!;
  button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
  button.click();
  expect(root.querySelectorAll('.tt-save-choice')).toHaveLength(3);
  root.querySelector<HTMLButtonElement>('[data-choice="word"]')!.click();
  expect((root.querySelector('.tt-save-text') as HTMLInputElement).value).toBe('议');
});

test('Sentence choice previews containing sentence when one character is selected', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn((_message, callback) => callback({ success: false })) } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, '我有建议。你呢？', { detectedLang: 'zh', translations: [] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const text = root.querySelector('.tt-source-text')!.firstChild!;
  const range = document.createRange(); range.setStart(text, 3); range.setEnd(text, 4);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, rangeCount: 1, getRangeAt: () => range, toString: () => '议' } as unknown as Selection);
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="sentence"]')!.click();
  expect((root.querySelector('.tt-save-text') as HTMLInputElement).value).toBe('我有建议。');
});

test('Both saves selected character and containing sentence as distinct linked item request', async () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  const sendMessage = vi.fn((message, callback) => callback(message.type === 'LEARNING_FOLDERS'
    ? { success: true, result: [{ id: 'folder', name: 'HSK', parent_id: null }] }
    : message.type === 'LEARNING_SUGGEST_MEANING'
      ? { success: true, meaning: message.text === '议' ? 'ý kiến' : 'Tôi có đề xuất.' }
      : { success: true }));
  vi.stubGlobal('chrome', { runtime: { sendMessage }, storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) } } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, '我有建议。', { detectedLang: 'zh', translations: [] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const text = root.querySelector('.tt-source-text')!.firstChild!;
  const range = document.createRange(); range.setStart(text, 3); range.setEnd(text, 4);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, rangeCount: 1, getRangeAt: () => range, toString: () => '议' } as unknown as Selection);
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="both"]')!.click();
  await vi.waitFor(() => expect((root.querySelector('.tt-save-folder') as HTMLSelectElement).options.length).toBe(2));
  (root.querySelector('.tt-save-folder') as HTMLSelectElement).value = 'folder';
  await vi.waitFor(() => expect((root.querySelector('.tt-save-meaning') as HTMLInputElement).value).toBe('ý kiến'));
  root.querySelector<HTMLFormElement>('.tt-save-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({
    type: 'LEARNING_SAVE', choice: 'both', item: {
      folder_id: 'folder', word_text: '议', word_meaning: 'ý kiến',
      sentence_text: '我有建议。', sentence_meaning: 'Tôi có đề xuất.',
    },
  }, expect.any(Function)));
});

test('no Learning Folder offers website creation path', async () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn((message, callback) => callback({ success: true, result: message.type === 'LEARNING_FOLDERS' ? [] : {} })) }, storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) } } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, '你好', { detectedLang: 'zh', translations: [] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="word"]')!.click();
  await Promise.resolve();
  expect(root.querySelector<HTMLButtonElement>('.tt-save-create-folder')).not.toBeNull();
});

test('folder chooser shows ancestry and never uses Chinese source as Meaning Suggestion', async () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn((message, callback) => callback(message.type === 'LEARNING_FOLDERS'
      ? { success: true, result: [{ id: 'child', name: 'Bài 1', parent_id: 'root' }, { id: 'root', name: 'HSK 1', parent_id: null }] }
      : { success: true, meaning: '让我们' })) },
    storage: { local: { get: vi.fn(async () => ({ defaultLearningFolder: 'child' })), set: vi.fn(async () => {}) } },
  });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, '让我们', { detectedLang: 'zh', translations: [{ lang: 'vi', text: 'hãy để chúng ta' }] });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="word"]')!.click();
  await vi.waitFor(() => expect(root.querySelector('.tt-save-folder')?.textContent).toContain('HSK 1 / Bài 1'));
  expect((root.querySelector('.tt-save-folder') as HTMLSelectElement).value).toBe('child');
  expect((root.querySelector('.tt-save-meaning') as HTMLInputElement).value).toBe('hãy để chúng ta');
});

test('saving whole translated sentence uses Vietnamese Source Text as confirmed meaning', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  const sendMessage = vi.fn((_message, callback) => callback({ success: false }));
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, 'Nếu định làm extension thương mại', {
    detectedLang: 'vi', translations: [{ lang: 'zh', text: '如果您计划进行商业扩展' }],
  });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="sentence"]')!.click();
  expect((root.querySelector('.tt-save-text') as HTMLInputElement).value).toBe('如果您计划进行商业扩展');
  expect((root.querySelector('.tt-save-meaning') as HTMLInputElement).value).toBe('Nếu định làm extension thương mại');
  expect(sendMessage.mock.calls.some(([message]) => message.type === 'LEARNING_SUGGEST_MEANING')).toBe(false);
});

test('Both uses Vietnamese Source Text for full sentence but translates selected word separately', () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  const sendMessage = vi.fn((message, callback) => callback(message.type === 'LEARNING_SUGGEST_MEANING'
    ? { success: true, meaning: 'kinh doanh' } : { success: false }));
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, 'Nếu định làm extension thương mại', {
    detectedLang: 'vi', translations: [{ lang: 'zh', text: '如果您计划进行商业扩展' }],
  });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const text = root.querySelector('.tt-translation-text')!.firstChild!;
  const range = document.createRange(); range.setStart(text, 7); range.setEnd(text, 9);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: false, rangeCount: 1, getRangeAt: () => range, toString: () => '商业' } as unknown as Selection);
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="both"]')!.click();
  expect((root.querySelector('.tt-save-meaning') as HTMLInputElement).value).toBe('');
  expect((root.querySelector('.tt-save-sentence-meaning') as HTMLInputElement).value).toBe('Nếu định làm extension thương mại');
  expect(sendMessage.mock.calls.filter(([message]) => message.type === 'LEARNING_SUGGEST_MEANING').map(([message]) => message.text)).toEqual(['商业']);
});
