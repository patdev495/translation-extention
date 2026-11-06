// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { getHanziBreakdown } from '../src/services/hanzi-breakdown';

const source = readFileSync(resolve(__dirname, '../third_party/makemeahanzi/dictionary.txt'), 'utf8');
const sourceRecords = new Map(source.split(/\r?\n/).filter(Boolean).map(line => {
  const record = JSON.parse(line);
  return [record.character, record];
}));

function servePackagedRecords(): void {
  vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://test/${path}` } });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const codePoint = Number.parseInt(url.match(/([0-9A-F]+)\.json$/)?.[1] ?? '', 16);
    const record = sourceRecords.get(String.fromCodePoint(codePoint));
    return { ok: !!record, json: async () => record };
  }));
}

describe('Hanzi Component Breakdown lookup', () => {
  test('a learner sees every immediate component and its known role', async () => {
    servePackagedRecords();
    const result = await getHanziBreakdown('妈');
    expect(result.components.map(({ character, meaning, role }) => ({ character, meaning, role }))).toEqual([
      { character: '女', meaning: 'woman, girl; female', role: 'meaning' },
      { character: '马', meaning: 'horse; surname', role: 'sound' },
    ]);
  });

  test('a structural grouping without its own glyph still reveals all named parts', async () => {
    servePackagedRecords();
    const result = await getHanziBreakdown('佞');
    expect(result.components.map(component => component.character)).toEqual(['亻', '二', '女']);
  });

  test('a partial decomposition keeps known parts and marks the unknown part', async () => {
    servePackagedRecords();
    const result = await getHanziBreakdown('伤');
    expect(result.components.map(component => ({ character: component.character, unknown: component.unknown })))
      .toEqual([
        { character: '亻', unknown: false },
        { character: '？', unknown: true },
        { character: '力', unknown: false },
      ]);
  });
});
