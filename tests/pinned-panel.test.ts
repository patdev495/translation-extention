import { describe, test, expect, beforeEach, vi } from 'vitest';
import { addPinnedSnippet, updatePinnedSnippetPosition, removePinnedSnippet, PinnedSnippet } from '../src/content/pinned-panel';

let mockStorage: Record<string, any> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | Record<string, any> | null) => {
        if (typeof keys === 'string') {
          return { [keys]: mockStorage[keys] };
        } else if (Array.isArray(keys)) {
          const res: Record<string, any> = {};
          keys.forEach(k => { res[k] = mockStorage[k]; });
          return res;
        } else if (keys && typeof keys === 'object') {
          const res: Record<string, any> = {};
          Object.keys(keys).forEach(k => {
            res[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k];
          });
          return res;
        }
        return mockStorage;
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.entries(items).forEach(([k, v]) => {
          mockStorage[k] = v;
        });
      }),
    }
  }
} as any;

describe('PinnedSnippet storage helpers', () => {
  beforeEach(() => {
    mockStorage = {
      settings: {
        ocrPinImage: true
      },
      pinned_snippets: []
    };
  });

  test('should not add pinned snippet if ocrPinImage setting is disabled', async () => {
    mockStorage.settings.ocrPinImage = false;
    await addPinnedSnippet('data:image/png;base64,abc', 100, 200);
    const snippets = mockStorage.pinned_snippets;
    expect(snippets).toEqual([]);
  });

  test('should add a pinned snippet when setting is enabled', async () => {
    await addPinnedSnippet('data:image/png;base64,abc', 100, 200, 300, 400);
    const snippets: PinnedSnippet[] = mockStorage.pinned_snippets;
    expect(snippets.length).toBe(1);
    expect(snippets[0].imageUrl).toBe('data:image/png;base64,abc');
    expect(snippets[0].x).toBe(100);
    expect(snippets[0].y).toBe(200);
    expect(snippets[0].width).toBe(300);
    expect(snippets[0].height).toBe(400);
    expect(snippets[0].id).toBeDefined();
  });

  test('should update pinned snippet position', async () => {
    mockStorage.pinned_snippets = [
      { id: 'test-id', imageUrl: 'img-url', x: 10, y: 20 }
    ];

    await updatePinnedSnippetPosition('test-id', 150, 250);
    const snippets: PinnedSnippet[] = mockStorage.pinned_snippets;
    expect(snippets[0].x).toBe(150);
    expect(snippets[0].y).toBe(250);
  });

  test('should remove pinned snippet', async () => {
    mockStorage.pinned_snippets = [
      { id: 'test-id-1', imageUrl: 'img-1', x: 10, y: 20 },
      { id: 'test-id-2', imageUrl: 'img-2', x: 30, y: 40 }
    ];

    await removePinnedSnippet('test-id-1');
    const snippets: PinnedSnippet[] = mockStorage.pinned_snippets;
    expect(snippets.length).toBe(1);
    expect(snippets[0].id).toBe('test-id-2');
  });
});
