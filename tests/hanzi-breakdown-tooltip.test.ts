// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import woData from 'hanzi-writer-data/妈.json';
import shangData from 'hanzi-writer-data/伤.json';
import renData from 'hanzi-writer-data/人.json';
import linData from 'hanzi-writer-data/临.json';
import { TranslationTooltip } from '../src/content/tooltip';
import { initTranslationListeners } from '../src/content/translation-init';

const records = new Map(readFileSync(resolve(__dirname, '../third_party/makemeahanzi/dictionary.txt'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(line => {
    const record = JSON.parse(line);
    return [record.character, record];
  }));
const learnerStorage: Record<string, unknown> = {};

afterEach(() => {
  for (const key of Object.keys(learnerStorage)) delete learnerStorage[key];
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setupTooltip(character = '妈'): TranslationTooltip {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('chrome', { storage: { local: {
    get: async (key: string) => ({ [key]: learnerStorage[key] }),
    set: async (values: Record<string, unknown>) => { Object.assign(learnerStorage, values); },
  } }, runtime: {
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
    if (url.includes('/hanzi-data/')) return { ok: true, json: async () =>
      url.includes('/4F24.json') ? shangData : url.includes('/4EBA.json') ? renData
        : url.includes('/4E34.json') ? linData : woData };
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
  test('the breakdown opens beside the translation tooltip when there is room on the right', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'en');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.id === 'tooltip') return { left: 100, right: 460, top: 120, bottom: 380, width: 360, height: 260 } as DOMRect;
      if (this.id === 'translation-extension-hanzi-breakdown-root') {
        return { left: 0, right: 320, top: 0, bottom: 300, width: 320, height: 300 } as DOMRect;
      }
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
    });
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const root = document.getElementById('translation-extension-hanzi-breakdown-root')!;
    await vi.waitFor(() => expect(root.shadowRoot?.textContent).toContain('mother, mama'));
    expect({ left: root.style.left, top: root.style.top }).toEqual({ left: '472px', top: '120px' });
  });

  test('the breakdown opens on the left when the tooltip is near the right edge', async () => {
    const tooltip = setupTooltip();
    tooltip.updateHanziBreakdownSettings(true, 'en');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.id === 'tooltip') return { left: 700, right: 970, top: 100, bottom: 360, width: 270, height: 260 } as DOMRect;
      if (this.id === 'translation-extension-hanzi-breakdown-root') {
        return { left: 0, right: 320, top: 0, bottom: 300, width: 320, height: 300 } as DOMRect;
      }
      return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 } as DOMRect;
    });
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const root = document.getElementById('translation-extension-hanzi-breakdown-root')!;
    await vi.waitFor(() => expect(root.shadowRoot?.textContent).toContain('mother, mama'));
    expect({ left: root.style.left, top: root.style.top }).toEqual({ left: '368px', top: '100px' });
  });

  test('multiple unknown slots are grouped into one picture of all unmatched strokes', async () => {
    const tooltip = setupTooltip('临');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')!.shadowRoot!;
    await vi.waitFor(() => expect(card().querySelector('svg[aria-label="Unidentified strokes for 临"]')).toBeTruthy());
    expect(card().querySelectorAll('.hanzi-breakdown-unidentified')).toHaveLength(1);
    expect(card().querySelectorAll('svg[aria-label="Unidentified strokes for 临"] path')).toHaveLength(8);
  });

  test('a character whose entire decomposition is unknown still shows its strokes', async () => {
    const tooltip = setupTooltip('人');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')!.shadowRoot!;
    await vi.waitFor(() => expect(card().querySelector('svg[aria-label="Unidentified strokes for 人"]')).toBeTruthy());
    expect(card().querySelectorAll('svg[aria-label="Unidentified strokes for 人"] path')).toHaveLength(2);
  });

  test('a memory note is still shown when the card reopens before its save completes', async () => {
    const tooltip = setupTooltip('媽');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    const characterButton = document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!;
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot;
    characterButton.click();
    await vi.waitFor(() => expect(card()?.querySelector('textarea[aria-label="Memory note"]')).toBeTruthy());
    let finishSave: (() => void) | undefined;
    vi.spyOn(chrome.storage.local, 'set').mockImplementation((values: Record<string, unknown>) => new Promise<void>(resolve => {
      finishSave = () => { Object.assign(learnerStorage, values); resolve(); };
    }));
    const note = card()!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory note"]')!;
    note.value = 'Remember this immediately';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    card()!.querySelector<HTMLButtonElement>('button[aria-label="Close breakdown"]')!.click();
    characterButton.click();
    characterButton.click();
    await vi.waitFor(() => expect(finishSave).toBeTruthy());
    finishSave!();
    await vi.waitFor(() => expect(card()?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory note"]')?.value)
      .toBe('Remember this immediately'));
  });

  test('rapid memory-note edits keep the latest text when saves finish out of order', async () => {
    const tooltip = setupTooltip('媽');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot;
    await vi.waitFor(() => expect(card()?.querySelector('textarea[aria-label="Memory note"]')).toBeTruthy());
    const pending: Array<() => void> = [];
    vi.spyOn(chrome.storage.local, 'set').mockImplementation((values: Record<string, unknown>) =>
      new Promise<void>(resolve => pending.push(() => { Object.assign(learnerStorage, values); resolve(); })));
    const note = card()!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory note"]')!;
    note.value = 'first idea';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    note.value = 'better idea';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
    if (pending.length === 2) {
      pending[1]();
      pending[0]();
    } else {
      pending[0]();
      await vi.waitFor(() => expect(pending.length).toBe(2));
      pending[1]();
    }
    await vi.waitFor(() => expect(learnerStorage['hanzi-learning-note:媽']).toBe('better idea'));
  });

  test('a learner can explain unidentified strokes for one character and see the explanation later', async () => {
    const tooltip = setupTooltip('伤');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    const characterButton = document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!;
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot;
    characterButton.click();
    await vi.waitFor(() => expect(card()?.querySelector('button[aria-label="Edit unidentified strokes for 伤"]')).toBeTruthy());
    card()!.querySelector<HTMLButtonElement>('button[aria-label="Edit unidentified strokes for 伤"]')!.click();
    const input = card()!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Explanation for unidentified strokes of 伤"]')!;
    input.value = 'Two slanting strokes like a bent roof';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    card()!.querySelector<HTMLButtonElement>('button[aria-label="Close breakdown"]')!.click();
    characterButton.click();
    characterButton.click();
    await vi.waitFor(() => expect(card()?.querySelector('.hanzi-breakdown-unidentified')?.textContent)
      .toContain('Two slanting strokes like a bent roof'));
  });

  test('unidentified strokes show the actual remaining shape instead of a question mark', async () => {
    const tooltip = setupTooltip('伤');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')!.shadowRoot!;
    await vi.waitFor(() => expect(card().querySelector('svg[aria-label="Unidentified strokes for 伤"]')).toBeTruthy());
    const paths = [...card().querySelectorAll('svg[aria-label="Unidentified strokes for 伤"] path')]
      .map(path => path.getAttribute('d'));
    expect(paths).toHaveLength(2);
    expect(paths[0]).toMatch(/^M 507 624 /);
    expect(paths[1]).toMatch(/^M 490 600 /);
    expect(card().textContent).not.toContain('？');
  });

  test('a personal meaning for a component follows that character into its own breakdown', async () => {
    const tooltip = setupTooltip('見');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')!.shadowRoot!;
    await vi.waitFor(() => expect(card().querySelector('button[aria-label="Edit meaning for 目"]')).toBeTruthy());
    card().querySelector<HTMLButtonElement>('button[aria-label="Edit meaning for 目"]')!.click();
    const input = card().querySelector<HTMLTextAreaElement>('textarea[aria-label="Personal meaning for 目"]')!;
    input.value = 'window for seeing';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    card().querySelector<HTMLButtonElement>('button[data-component="目"]')!.click();
    await vi.waitFor(() => expect(card().querySelector('.hanzi-breakdown-definition')?.textContent)
      .toContain('window for seeing'));
  });

  test('a learner can edit the main meaning and switch back to the original without losing either', async () => {
    const tooltip = setupTooltip('妈');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    const characterButton = document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!;
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot;
    characterButton.click();
    await vi.waitFor(() => expect(card()?.querySelector('button[aria-label="Edit meaning for 妈"]')).toBeTruthy());
    card()!.querySelector<HTMLButtonElement>('button[aria-label="Edit meaning for 妈"]')!.click();
    const input = card()!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Personal meaning for 妈"]')!;
    input.value = 'My mother mnemonic';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    card()!.querySelector<HTMLButtonElement>('button[aria-label="Close breakdown"]')!.click();
    characterButton.click();
    characterButton.click();
    await vi.waitFor(() => expect(card()?.querySelector('.hanzi-breakdown-definition')?.textContent)
      .toContain('My mother mnemonic'));
    card()!.querySelector<HTMLButtonElement>('button[aria-label="Show original meaning for 妈"]')!.click();
    expect(card()!.querySelector('.hanzi-breakdown-definition')?.textContent).toContain('mother, mama');
    card()!.querySelector<HTMLButtonElement>('button[aria-label="Show personal meaning for 妈"]')!.click();
    expect(card()!.querySelector('.hanzi-breakdown-definition')?.textContent).toContain('My mother mnemonic');
  });

  test('a learner can write a memory note and see it after reopening the same character', async () => {
    const tooltip = setupTooltip('媽');
    tooltip.updateHanziBreakdownSettings(true, 'en');
    document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!.click();
    const card = () => document.getElementById('translation-extension-hanzi-breakdown-root')?.shadowRoot;
    await vi.waitFor(() => expect(card()?.querySelector('textarea[aria-label="Memory note"]')).toBeTruthy());
    const note = card()!.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory note"]')!;
    note.value = 'A small story about this character';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    card()!.querySelector<HTMLButtonElement>('button[aria-label="Close breakdown"]')!.click();
    const characterButton = document.getElementById('translation-extension-root')!.shadowRoot!
      .querySelector<HTMLButtonElement>('.tt-hanzi-button')!;
    characterButton.click();
    characterButton.click();
    await vi.waitFor(() => expect(card()?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Memory note"]')?.value)
      .toBe('A small story about this character'));
  });

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

  test('a character without dictionary data explains the missing breakdown', async () => {
    const tooltip = setupTooltip('𠀀');
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
