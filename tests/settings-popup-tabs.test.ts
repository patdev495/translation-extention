// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';

const html = readFileSync(resolve(__dirname, '../popup/index.html'), 'utf8');

async function mount(initial: Record<string, any> = {}) {
  vi.resetModules();
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  const storage: Record<string, any> = { privacyConsentGranted: true, ...initial };
  const set = vi.fn(async (values: Record<string, any>) => { Object.assign(storage, values); });
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map((key) => [key, storage[key]]),
        )),
        set,
      },
      onChanged: { addListener: vi.fn() },
    },
    tabs: { query: vi.fn((_query, callback) => callback([])) },
    runtime: { sendMessage: vi.fn(async () => undefined) },
  });
  await import('../popup/popup');
  await vi.waitFor(() => expect(select('reverse-lang').value).toBe('en'));
  return { storage, set };
}

function select(id: string) { return document.getElementById(id) as HTMLSelectElement; }
function input(id: string) { return document.getElementById(id) as HTMLInputElement; }
function clickTab(name: string) { document.getElementById(`tab-${name}`)!.click(); }
function change(id: string, value: string) {
  select(id).value = value;
  select(id).dispatchEvent(new Event('change', { bubbles: true }));
}
function expectSelected(name: string) {
  expect(document.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe(`tab-${name}`);
  expect(Array.from(document.querySelectorAll<HTMLElement>('[role="tabpanel"]')).filter((panel) => !panel.hidden)
    .map((panel) => panel.id)).toEqual([`panel-${name}`]);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

test('switching tabs remembers the choice without writing settings or losing panel state', async () => {
  const { storage, set } = await mount();
  expectSelected('languages');
  clickTab('display');
  const choice = document.getElementById('hanzi-import-choice')!;
  choice.hidden = false;
  document.getElementById('hanzi-import-summary')!.textContent = '2 conflicts';
  clickTab('website');
  clickTab('display');
  expectSelected('display');
  expect(choice.hidden).toBe(false);
  expect(choice.textContent).toContain('2 conflicts');
  expect(storage.settingsPopupTab).toBe('tab-display');
  expect(set.mock.calls.every(([values]) => Object.keys(values).join() === 'settingsPopupTab')).toBe(true);

  await mount({ settingsPopupTab: storage.settingsPopupTab });
  expectSelected('display');
});

test('tab navigation wraps with arrow keys and supports Home and End with one tab stop', async () => {
  await mount();
  const key = (value: string) => document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
  );
  document.getElementById('tab-languages')!.focus();
  key('ArrowLeft');
  expectSelected('ocr');
  expect(document.activeElement?.id).toBe('tab-ocr');
  key('ArrowRight');
  expectSelected('languages');
  key('End');
  expectSelected('ocr');
  key('Home');
  expectSelected('languages');
  expect(document.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
});

test('an invalid stored tab defaults to Languages', async () => {
  await mount({ settingsPopupTab: 'removed-tab' });
  expectSelected('languages');
});

test('a delayed tab restore cannot override a new user choice', async () => {
  document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
  let restore!: (value: Record<string, string>) => void;
  vi.stubGlobal('chrome', { storage: { local: {
    get: () => new Promise((resolve) => { restore = resolve; }),
    set: async () => {},
  } } });
  const { initializeSettingsTabs } = await import('../popup/tabs');
  initializeSettingsTabs();
  clickTab('ocr');
  restore({ settingsPopupTab: 'tab-display' });
  await Promise.resolve();
  expectSelected('ocr');
});

test('privacy consent still gates the popup and preserves the restored tab after accepting', async () => {
  const { storage } = await mount({ privacyConsentGranted: false, settingsPopupTab: 'tab-website' });
  expect(document.getElementById('privacy-consent')!.hidden).toBe(false);
  expect(input('active-toggle').disabled).toBe(true);
  document.getElementById('privacy-consent-accept')!.click();
  await vi.waitFor(() => expect(document.getElementById('privacy-consent')!.hidden).toBe(true));
  expect(input('active-toggle').disabled).toBe(false);
  expect(storage.active).toBe(true);
  expectSelected('website');
});

test('settings save across hidden panels and disabling Primary Target explains the dependency in Languages', async () => {
  const { storage } = await mount();
  clickTab('display');
  change('tooltip-font-size', '24');
  await vi.waitFor(() => expect(storage.settings?.tooltipFontSize).toBe('24'));
  clickTab('languages');
  change('primary-lang', 'none');
  await vi.waitFor(() => expect(storage.settings?.inputReplacementEnabled).toBe(false));
  expect(storage.settings.tooltipFontSize).toBe('24');
  expect(document.getElementById('languages-error')!.classList.contains('visible')).toBe(true);
  clickTab('provider');
  expect(input('input-replacement-enabled').checked).toBe(false);
  expect(input('input-replacement-shortcut').disabled).toBe(true);
});

test('an OCR shortcut conflict is explained in OCR and leaves the previous saved shortcut intact', async () => {
  const { storage } = await mount({ settings: { inputReplacementShortcut: 'Alt+KeyO' } });
  clickTab('ocr');
  change('ocr-shortcut', 'alt-o');
  await vi.waitFor(() => expect(select('ocr-shortcut').value).toBe('ctrl-space'));
  expect(document.getElementById('ocr-shortcut-error')!.classList.contains('visible')).toBe(true);
  expect(storage.settings.ocrShortcut).toBeUndefined();
  change('ocr-shortcut', 'ctrl-shift-o');
  await vi.waitFor(() => expect(storage.settings.ocrShortcut).toBe('ctrl-shift-o'));
  expect(document.getElementById('ocr-shortcut-error')!.textContent).toBe('');
  clickTab('provider');
  const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
  input('input-replacement-shortcut').dispatchEvent(tabEvent);
  expect(tabEvent.defaultPrevented).toBe(false);
  expect(storage.settings.inputReplacementShortcut).toBe('Alt+KeyO');
});
