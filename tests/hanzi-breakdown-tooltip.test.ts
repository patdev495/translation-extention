// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import woData from 'hanzi-writer-data/妈.json';
import { TranslationTooltip } from '../src/content/tooltip';
import { initTranslationListeners } from '../src/content/translation-init';

const records = new Map(readFileSync(resolve(__dirname, '../third_party/makemeahanzi/dictionary.txt'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(line => {
    const record = JSON.parse(line);
    return [record.character, record];
  }));

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setupTooltip(character = '妈'): TranslationTooltip {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('chrome', { runtime: {
    getURL: (path: string) => `chrome-extension://test/${path}`,
    sendMessage: (message: { meaning: string }, callback: (response: unknown) => void) => {
      const translations: Record<string, string> = {
        'woman, girl; female': 'phụ nữ',
        'horse; surname': 'ngựa',
      };
      callback({ success: true, meaning: translations[message.meaning] ?? message.meaning });
    },
  } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/hanzi-data/')) return { ok: true, json: async () => woData };
    const codePoint = Number.parseInt(url.match(/([0-9A-F]+)\.json$/)?.[1] ?? '', 16);
    const record = records.get(String.fromCodePoint(codePoint));
    return { ok: !!record, json: async () => record };
  }));
  const tooltip = new TranslationTooltip();
  tooltip.show(0, 0, 'mẹ', {
    detectedLang: 'vi', translations: [{ lang: 'zh', text: character, phonetics: '' }],
  });
  const root = document.getElementById('translation-extension-root')!.shadowRoot!;
  const text = root.querySelector('.tt-translation-text')!;
  const range = document.createRange();
  range.selectNodeContents(text);
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false, rangeCount: 1, anchorNode: text.firstChild,
    focusNode: text.firstChild, toString: () => character, getRangeAt: () => range,
  } as unknown as Selection);
  text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
  return tooltip;
}

describe('Hanzi Breakdown Tooltip', () => {
  test('starting a loop with breakdown enabled opens a separate card with every immediate component', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'en');
    const sourceRoot = document.getElementById('translation-extension-root')!.shadowRoot!;
    sourceRoot.querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();

    await vi.waitFor(() => {
      const cardRoot = document.getElementById('translation-extension-hanzi-breakdown-root');
      expect(cardRoot?.shadowRoot?.textContent).toContain('woman, girl; female');
      expect(cardRoot?.shadowRoot?.textContent).toContain('horse; surname');
      expect(cardRoot?.shadowRoot?.textContent).toContain('mother, mama');
      expect(cardRoot?.shadowRoot?.textContent).toContain('nǚ');
      expect(cardRoot?.shadowRoot?.textContent).toContain('mǎ');
      expect(sourceRoot.querySelector('.hanzi-breakdown-card')).toBeNull();
    });
  });

  test('closing the breakdown card leaves the character loop active', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'en');
    const sourceRoot = document.getElementById('translation-extension-root')!.shadowRoot!;
    const characterButton = sourceRoot.querySelector<HTMLButtonElement>('.tt-hanzi-button')!;
    characterButton.click();
    await vi.waitFor(() => expect(document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.querySelector('button[aria-label="Close breakdown"]')).toBeTruthy());

    document.getElementById('translation-extension-hanzi-breakdown-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('button[aria-label="Close breakdown"]')!.click();
    expect({ card: document.getElementById('translation-extension-hanzi-breakdown-root'), looping: characterButton.getAttribute('aria-pressed') })
      .toEqual({ card: null, looping: 'true' });
  });

  test('a learner can inspect a component one level deeper and return in the same card', async () => {
    const tooltip = setupTooltip('想');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')!.shadowRoot!;
    await vi.waitFor(() => expect(card().querySelector<HTMLButtonElement>('button[data-component="相"]')).toBeTruthy());

    card().querySelector<HTMLButtonElement>('button[data-component="相"]')!.click();
    await vi.waitFor(() => expect(card().textContent).toContain('tree; wood'));
    expect(card().textContent).toContain('eye');
    card().querySelector<HTMLButtonElement>('button[aria-label="Back to 想"]')!.click();
    await vi.waitFor(() => expect(card().querySelector('button[data-component="相"]')).toBeTruthy());
  });

  test('the Vietnamese setting translates component meanings and the entire explanatory card', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'vi');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    await vi.waitFor(() => {
      const text = document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.textContent ?? '';
      expect(text).toContain('Phân rã chữ Hán');
      expect(text).toContain('phụ nữ');
      expect(text).toContain('ngựa');
      expect(text).toContain('Gợi âm');
    });
  });

  test('interacting with the separate card keeps the original tooltip open', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'en');
    initTranslationListeners({ tooltip, settings: null, active: true, lastSelection: { text: '', x: 0, y: 0 } }, document);
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    await vi.waitFor(() => expect(document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.querySelector('.hanzi-breakdown-card')).toBeTruthy());
    document.getElementById('translation-extension-hanzi-breakdown-root')!.shadowRoot!
      .querySelector('.hanzi-breakdown-card')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));

    expect(document.getElementById('translation-extension-root')!.shadowRoot!.querySelector<HTMLElement>('#tooltip')!.style.display)
      .toBe('block');
  });

  test('a learner can drag the breakdown card without moving the original tooltip', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'en');
    const sourceRoot = document.getElementById('translation-extension-root')!.shadowRoot!;
    sourceRoot.querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    await vi.waitFor(() => expect(document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.querySelector('.hanzi-breakdown-heading')).toBeTruthy());
    const root = document.getElementById('translation-extension-hanzi-breakdown-root')!;
    const originalLeft = sourceRoot.querySelector<HTMLElement>('#tooltip')!.style.left;

    root.shadowRoot!.querySelector('.hanzi-breakdown-heading')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: 100, clientY: 100, button: 0 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 130, clientY: 140 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(root.style.left).not.toBe('');
    expect(sourceRoot.querySelector<HTMLElement>('#tooltip')!.style.left).toBe(originalLeft);
  });

  test('a new translation closes the previous character breakdown', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    await vi.waitFor(() => expect(document.getElementById('translation-extension-hanzi-breakdown-root')).toBeTruthy());

    tooltip.show(0, 0, 'hello', { detectedLang: 'en', translations: [{ lang: 'vi', text: 'xin chào' }] });
    expect(document.getElementById('translation-extension-hanzi-breakdown-root')).toBeNull();
  });

  test('changing breakdown language updates the open card', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'vi');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const cardText = () => document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.textContent ?? '';
    await vi.waitFor(() => expect(cardText()).toContain('phụ nữ'));

    tooltip.updateHanziBreakdownSettings(true, 'en');
    await vi.waitFor(() => expect(cardText()).toContain('woman, girl; female'));
    expect(cardText()).toContain('Hanzi breakdown');
  });

  test('only the most recently activated loop has a card, and stopping it closes that card', async () => {
    const tooltip = setupTooltip('妈想');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    const buttons = [...document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelectorAll<HTMLButtonElement>('.tt-hanzi-button')];
    buttons[0].click();
    await vi.waitFor(() => expect(document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.textContent).toContain('horse; surname'));
    buttons[1].click();
    await vi.waitFor(() => expect(document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.textContent).toContain('想'));
    expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual(['true', 'true']);

    buttons[1].click();
    expect(document.getElementById('translation-extension-hanzi-breakdown-root')).toBeNull();
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  });

  test('a character without known components explains the missing breakdown', async () => {
    const tooltip = setupTooltip('女');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    await vi.waitFor(() => {
      const text = document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.textContent ?? '';
      expect(text).toContain('No component data');
    });
  });

  test('the card appears while Vietnamese meanings are still loading', () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'vi');
    vi.spyOn(chrome.runtime, 'sendMessage').mockImplementation(() => new Promise(() => {}));
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();

    expect(document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot?.textContent)
      .toContain('Đang tải');
  });
});
