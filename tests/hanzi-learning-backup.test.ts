// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('Hanzi learning backup in the extension popup', () => {
  test('an invalid backup is rejected without changing learner content', async () => {
    const html = readFileSync(resolve(__dirname, '../popup/index.html'), 'utf8');
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    const stored: Record<string, unknown> = { 'hanzi-learning-note:見': 'Current note' };
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string | null) => key === null ? { ...stored } : { [key]: stored[key] },
          set: async (values: Record<string, unknown>) => { Object.assign(stored, values); },
        },
        onChanged: { addListener: vi.fn() },
      },
      tabs: { query: vi.fn((_query, callback) => callback([])) },
      runtime: { sendMessage: vi.fn(async () => undefined) },
    });
    let exported: Blob | undefined;
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => { exported = blob; return 'blob:backup'; },
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await import('../popup/popup');
    const input = document.getElementById('hanzi-backup-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([JSON.stringify({
      version: 99, entries: { 見: { note: 'Overwrite' } },
    })], 'unsupported.json')] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.getElementById('hanzi-backup-status')?.textContent)
      .toContain('Invalid or unsupported'));
    document.getElementById('hanzi-export-backup')!.click();
    await vi.waitFor(() => expect(exported).toBeTruthy());
    expect(JSON.parse(await readBlob(exported!))).toEqual({ version: 1, entries: { 見: { note: 'Current note' } } });
  });

  test('the learner can keep current values for conflicts while adding new entries', async () => {
    const html = readFileSync(resolve(__dirname, '../popup/index.html'), 'utf8');
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    const stored: Record<string, unknown> = { 'hanzi-learning-note:見': 'Current note' };
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string | null) => key === null ? { ...stored } : { [key]: stored[key] },
          set: async (values: Record<string, unknown>) => { Object.assign(stored, values); },
        },
        onChanged: { addListener: vi.fn() },
      },
      tabs: { query: vi.fn((_query, callback) => callback([])) },
      runtime: { sendMessage: vi.fn(async () => undefined) },
    });
    let exported: Blob | undefined;
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => { exported = blob; return 'blob:backup'; },
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await import('../popup/popup');
    const input = document.getElementById('hanzi-backup-file') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([JSON.stringify({
      version: 1, entries: { 見: { note: 'File note' }, 目: { meanings: { en: 'eye' } } },
    })], 'backup.json')] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect((document.getElementById('hanzi-import-choice') as HTMLDivElement).hidden).toBe(false));
    document.getElementById('hanzi-import-keep-current')!.click();
    await vi.waitFor(() => expect(document.getElementById('hanzi-backup-status')?.textContent).toContain('imported'));
    document.getElementById('hanzi-export-backup')!.click();
    await vi.waitFor(() => expect(exported).toBeTruthy());
    expect(JSON.parse(await readBlob(exported!))).toEqual({ version: 1, entries: {
      見: { note: 'Current note' }, 目: { meanings: { en: 'eye' } },
    } });
  });

  test('the learner can merge a file and choose its value for conflicts', async () => {
    const html = readFileSync(resolve(__dirname, '../popup/index.html'), 'utf8');
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    const stored: Record<string, unknown> = {
      'hanzi-learning-note:見': 'Current note',
      'hanzi-learning-note:媽': 'Keep this note',
    };
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string | null) => key === null ? { ...stored } : { [key]: stored[key] },
          set: async (values: Record<string, unknown>) => { Object.assign(stored, values); },
        },
        onChanged: { addListener: vi.fn() },
      },
      tabs: { query: vi.fn((_query, callback) => callback([])) },
      runtime: { sendMessage: vi.fn(async () => undefined) },
    });
    let exported: Blob | undefined;
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => { exported = blob; return 'blob:backup'; },
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await import('../popup/popup');
    const input = document.getElementById('hanzi-backup-file') as HTMLInputElement;
    const file = new File([JSON.stringify({ version: 1, entries: {
      見: { note: 'Imported note' },
      目: { meanings: { vi: 'mắt để nhìn' } },
    } })], 'backup.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect((document.getElementById('hanzi-import-choice') as HTMLDivElement).hidden).toBe(false));
    document.getElementById('hanzi-import-use-file')!.click();
    await vi.waitFor(() => expect(document.getElementById('hanzi-backup-status')?.textContent).toContain('imported'));
    document.getElementById('hanzi-export-backup')!.click();
    await vi.waitFor(() => expect(exported).toBeTruthy());
    expect(JSON.parse(await readBlob(exported!))).toEqual({ version: 1, entries: {
      見: { note: 'Imported note' },
      媽: { note: 'Keep this note' },
      目: { meanings: { vi: 'mắt để nhìn' } },
    } });
  });

  test('the learner can export only their Hanzi meanings and notes as JSON', async () => {
    const html = readFileSync(resolve(__dirname, '../popup/index.html'), 'utf8');
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    const stored: Record<string, unknown> = {
      settings: { deeplApiKey: 'private-key' },
      'hanzi-learning-note:見': 'Eye above person',
      'hanzi-learning-meaning:目:vi': 'con mắt',
    };
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string | null) => key === null ? { ...stored } : { [key]: stored[key] },
          set: async (values: Record<string, unknown>) => { Object.assign(stored, values); },
        },
        onChanged: { addListener: vi.fn() },
      },
      tabs: { query: vi.fn((_query, callback) => callback([])) },
      runtime: { sendMessage: vi.fn(async () => undefined) },
    });
    let exported: Blob | undefined;
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => { exported = blob; return 'blob:backup'; },
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await import('../popup/popup');
    document.getElementById('hanzi-export-backup')!.click();
    await vi.waitFor(() => expect(exported).toBeTruthy());
    const backup = JSON.parse(await readBlob(exported!));
    expect(backup).toEqual({
      version: 1,
      entries: { 見: { note: 'Eye above person' }, 目: { meanings: { vi: 'con mắt' } } },
    });
    expect(JSON.stringify(backup)).not.toContain('private-key');
  });
});
