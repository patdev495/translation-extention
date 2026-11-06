import { describe, expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('packaged Hanzi Stroke Order Animation', () => {
  test('the built extension contains offline character data accessible to content scripts', () => {
    const root = resolve(__dirname, '..');
    execFileSync(process.execPath, ['scripts/build.js'], { cwd: root, stdio: 'pipe' });

    const dataPath = resolve(root, 'dist/hanzi-data/6211.json');
    const manifest = JSON.parse(readFileSync(resolve(root, 'dist/manifest.json'), 'utf8'));
    const resources = manifest.web_accessible_resources.flatMap((entry: { resources: string[] }) => entry.resources);

    expect(existsSync(dataPath)).toBe(true);
    expect(existsSync(resolve(root, 'dist/hanzi-data/518D.json'))).toBe(true);
    expect(existsSync(resolve(root, 'dist/hanzi-data/6B21.json'))).toBe(true);
    expect(existsSync(resolve(root, 'dist/hanzi-data/ARPHICPL.TXT'))).toBe(true);
    expect(existsSync(resolve(root, 'dist/licenses/hanzi-writer-MIT.txt'))).toBe(true);
    expect(resources).toContain('hanzi-data/*');
  }, 120_000);
});
