// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { TranslationTooltip } from '../src/content/tooltip';

function stubLinkedChrome(value: any): void {
  const send = value.runtime.sendMessage;
  value.runtime.sendMessage = (message: any, callback: (response: any) => void) => message.type === 'GET_ACCOUNT_LINK_STATUS'
    ? callback({ success: true, status: { state: 'linked' } }) : send(message, callback);
  vi.stubGlobal('chrome', value);
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup(text = '我喜欢学习。你呢？') {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const sendMessage = vi.fn((message, callback) => callback(message.type === 'LEARNING_FOLDERS'
    ? { success: true, result: [{ id: 'folder', name: 'HSK', parent_id: null }] }
    : message.type === 'LEARNING_SUGGEST_MEANING' ? { success: true, meaning: 'học' } : { success: true }));
  stubLinkedChrome( { runtime: { getURL: (path: string) => path, sendMessage }, storage: { local: { get: vi.fn(async () => ({ defaultLearningFolder: 'folder' })), set: vi.fn(async () => {}) } } });
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, text, { detectedLang: 'zh', sourcePhonetics: '我 wǒ · 喜欢 xǐ huān · 学习 xué xí · 你 nǐ · 呢 ne', translations: [] });
  return { root: document.getElementById('translation-extension-root')!.shadowRoot!, sendMessage };
}

function selectText(root: ShadowRoot, start: number, end: number): void {
  const row = root.querySelector('.tt-source-text')!;
  const at = (offset: number) => {
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (offset <= node.length) return { node, offset };
      offset -= node.length;
    }
    throw new Error('outside row');
  };
  const first = at(start), last = at(end);
  const range = document.createRange();
  range.setStart(first.node, first.offset); range.setEnd(last.node, last.offset);
  const selected = { isCollapsed: false, rangeCount: 1, anchorNode: first.node, focusNode: last.node, getRangeAt: () => range, toString: () => range.toString(), removeAllRanges: vi.fn(), addRange: vi.fn() } as unknown as Selection;
  vi.spyOn(window, 'getSelection').mockReturnValue(selected);
  row.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
}

test('selecting same Chinese phrase twice clears Reading Focus; a different phrase replaces it', () => {
  const { root } = setup();
  selectText(root, 3, 5);
  expect([...root.querySelectorAll('.tt-source-text .tt-reading-focus')].map(node => node.textContent).join('')).toBe('学习');
  selectText(root, 3, 5);
  expect(root.querySelectorAll('.tt-reading-focus')).toHaveLength(0);
  selectText(root, 1, 3);
  expect([...root.querySelectorAll('.tt-source-text .tt-reading-focus')].map(node => node.textContent).join('')).toBe('喜欢');
  selectText(root, 3, 5);
  expect([...root.querySelectorAll('.tt-source-text .tt-reading-focus')].map(node => node.textContent).join('')).toBe('学习');
});

test('clicking an already focused Chinese phrase clears its highlight', () => {
  const { root } = setup();
  selectText(root, 3, 5);
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: true, rangeCount: 0, toString: () => '' } as unknown as Selection);
  root.querySelector('.tt-source-text .tt-reading-focus')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  expect(root.querySelectorAll('.tt-reading-focus')).toHaveLength(0);
});

test('choice menu title tracks selected text while open', () => {
  const { root } = setup();
  selectText(root, 3, 5);
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  expect(root.querySelector('.tt-save-title')?.textContent).toContain('学习');
  selectText(root, 1, 3);
  expect(root.querySelector('.tt-save-title')?.textContent).toContain('喜欢');
  root.querySelector<HTMLButtonElement>('[data-choice="word"]')!.click();
  expect((root.querySelector('.tt-save-text') as HTMLInputElement).value).toBe('喜欢');
});

test('number keys choose visible category despite bubbling being stopped inside tooltip', () => {
  const { root } = setup();
  selectText(root, 3, 5);
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  const choice = root.querySelector<HTMLButtonElement>('[data-choice="both"]')!;
  choice.addEventListener('keydown', event => event.stopPropagation());
  choice.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true, composed: true }));
  expect(root.querySelector('.tt-save-form')).not.toBeNull();
  expect(root.querySelector('.tt-save-sentence')).not.toBeNull();
});

test('x closes Save Choice Menu and save form back to original Translation Tooltip', async () => {
  const { root, sendMessage } = setup('你好');
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  expect(root.querySelector('.tt-save-panel')).not.toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
  expect(root.querySelector('.tt-save-panel')).toBeNull();
  expect(root.querySelector('.tt-source-text')?.textContent).toBe('你好');
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="word"]')!.click();
  expect(root.querySelector('.tt-save-form')).not.toBeNull();
  await vi.waitFor(() => expect((root.querySelector('.tt-save-folder') as HTMLSelectElement).options.length).toBe(2));
  const meaning = root.querySelector<HTMLInputElement>('.tt-save-meaning')!;
  meaning.focus();
  meaning.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, composed: true }));
  expect(root.querySelector('.tt-save-form')).not.toBeNull();
  const folder = root.querySelector<HTMLSelectElement>('.tt-save-folder')!;
  folder.focus();
  folder.dispatchEvent(new KeyboardEvent('keydown', { key: 'X', bubbles: true, composed: true }));
  expect(root.querySelector('.tt-save-panel')).toBeNull();
  expect(root.querySelector('.tt-source-text')?.textContent).toBe('你好');
  expect(sendMessage.mock.calls.some(([message]) => message.type === 'LEARNING_SAVE')).toBe(false);
});

test('s submits ready save form and announces success without reopening choices', async () => {
  const { root, sendMessage } = setup('你好');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
  root.querySelector<HTMLButtonElement>('[data-choice="word"]')!.click();
  await vi.waitFor(() => expect((root.querySelector('.tt-save-folder') as HTMLSelectElement).value).toBe('folder'));
  await vi.waitFor(() => expect((root.querySelector('.tt-save-meaning') as HTMLInputElement).value).toBe('học'));
  root.querySelector<HTMLInputElement>('.tt-save-meaning')!.focus();
  root.querySelector<HTMLInputElement>('.tt-save-meaning')!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, composed: true }));
  expect(sendMessage.mock.calls.some(([message]) => message.type === 'LEARNING_SAVE')).toBe(false);
  root.querySelector<HTMLInputElement>('.tt-save-meaning')!.blur();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
  await vi.waitFor(() => expect(sendMessage.mock.calls.some(([message]) => message.type === 'LEARNING_SAVE')).toBe(true));
  await vi.waitFor(() => expect(root.querySelector('.tt-save-success')?.textContent).toContain('Đã lưu'));
  expect(root.querySelector('.tt-save-choice')).toBeNull();
});

test('s saves after choosing a Learning Folder while its select still has focus', async () => {
  const { root, sendMessage } = setup('你好');
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="word"]')!.click();
  await vi.waitFor(() => expect((root.querySelector('.tt-save-folder') as HTMLSelectElement).value).toBe('folder'));
  await vi.waitFor(() => expect((root.querySelector('.tt-save-meaning') as HTMLInputElement).value).toBe('học'));
  const folder = root.querySelector<HTMLSelectElement>('.tt-save-folder')!;
  folder.focus();
  folder.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, composed: true }));
  await vi.waitFor(() => expect(sendMessage.mock.calls.some(([message]) => message.type === 'LEARNING_SAVE')).toBe(true));
});

test('clicking outside the meaning field releases its focus so s can save', async () => {
  const { root, sendMessage } = setup('你好');
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="word"]')!.click();
  await vi.waitFor(() => expect((root.querySelector('.tt-save-folder') as HTMLSelectElement).value).toBe('folder'));
  await vi.waitFor(() => expect((root.querySelector('.tt-save-meaning') as HTMLInputElement).value).toBe('học'));
  const meaning = root.querySelector<HTMLInputElement>('.tt-save-meaning')!;
  meaning.focus();
  expect(root.activeElement).toBe(meaning);
  root.querySelector<HTMLElement>('.tt-save-panel')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
  expect(root.activeElement).not.toBe(meaning);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
  await vi.waitFor(() => expect(sendMessage.mock.calls.some(([message]) => message.type === 'LEARNING_SAVE')).toBe(true));
});

test('clicking outside the sentence meaning field releases its focus so s can save both', async () => {
  const { root, sendMessage } = setup();
  selectText(root, 3, 5);
  root.querySelector<HTMLButtonElement>('.tt-save-button')!.click();
  root.querySelector<HTMLButtonElement>('[data-choice="both"]')!.click();
  await vi.waitFor(() => expect((root.querySelector('.tt-save-folder') as HTMLSelectElement).value).toBe('folder'));
  await vi.waitFor(() => expect((root.querySelector('.tt-save-meaning') as HTMLInputElement).value).toBe('học'));
  const sentenceMeaning = root.querySelector<HTMLInputElement>('.tt-save-sentence-meaning')!;
  sentenceMeaning.value = 'Tôi thích học. Còn bạn?';
  sentenceMeaning.focus();
  expect(root.activeElement).toBe(sentenceMeaning);
  root.querySelector<HTMLElement>('.tt-save-panel')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
  expect(root.activeElement).not.toBe(sentenceMeaning);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
  await vi.waitFor(() => expect(sendMessage.mock.calls.some(([message]) => message.type === 'LEARNING_SAVE')).toBe(true));
});
