import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('packaged Hanzi Component Breakdown', () => {
  test('the built extension contains Make Me a Hanzi decomposition and its license', () => {
    const root = resolve(__dirname, '..');
    execFileSync(process.execPath, ['scripts/build.js'], { cwd: root, stdio: 'pipe' });
    const record = JSON.parse(readFileSync(resolve(root, 'dist/hanzi-dictionary/5988.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(resolve(root, 'dist/manifest.json'), 'utf8'));
    const resources = manifest.web_accessible_resources.flatMap((entry: { resources: string[] }) => entry.resources);

    expect({ character: record.character, decomposition: record.decomposition, radical: record.radical }).toEqual({
      character: '妈', decomposition: '⿰女马', radical: '女',
    });
    expect(existsSync(resolve(root, 'dist/licenses/makemeahanzi-LGPL.txt'))).toBe(true);
    expect(resources).toContain('hanzi-dictionary/*');
  }, 120_000);
});
