import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OcrSelectionOverlay } from '../src/content/ocr-selection-overlay';

// Mock DOM environment minimally
const mockDocumentListeners: Record<string, Function[]> = {};
const mockWindowListeners: Record<string, Function[]> = {};

global.document = {
  addEventListener: vi.fn((event: string, callback: any) => {
    if (!mockDocumentListeners[event]) mockDocumentListeners[event] = [];
    mockDocumentListeners[event].push(callback);
  }),
  removeEventListener: vi.fn((event: string, callback: any) => {
    if (mockDocumentListeners[event]) {
      mockDocumentListeners[event] = mockDocumentListeners[event].filter(cb => cb !== callback);
    }
  }),
  createElement: vi.fn((tagName: string) => {
    return {
      tagName,
      style: {},
      attachShadow: vi.fn(() => ({
        appendChild: vi.fn(),
        querySelector: vi.fn(),
      })),
      appendChild: vi.fn(),
      remove: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;
  }),
  body: {
    appendChild: vi.fn(),
  },
  querySelectorAll: vi.fn(() => ({
    forEach: vi.fn(),
  })),
} as any;

global.window = {
  addEventListener: vi.fn((event: string, callback: any) => {
    if (!mockWindowListeners[event]) mockWindowListeners[event] = [];
    mockWindowListeners[event].push(callback);
  }),
  removeEventListener: vi.fn((event: string, callback: any) => {
    if (mockWindowListeners[event]) {
      mockWindowListeners[event] = mockWindowListeners[event].filter(cb => cb !== callback);
    }
  }),
  getSelection: vi.fn(() => ({
    removeAllRanges: vi.fn(),
  })),
} as any;

describe('OcrSelectionOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockDocumentListeners).forEach(key => delete mockDocumentListeners[key]);
    Object.keys(mockWindowListeners).forEach(key => delete mockWindowListeners[key]);
  });

  test('should attach keydown listener on start and remove on stop', () => {
    const root = document.createElement('div');
    const onSelectionComplete = vi.fn();
    const overlay = new OcrSelectionOverlay(root, { onSelectionComplete });

    overlay.start();
    expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);

    overlay.stop();
    expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  });

  test('should clean up overlay element when stopped in shadowMode', () => {
    const root = document.createElement('div');
    const onSelectionComplete = vi.fn();
    const overlay = new OcrSelectionOverlay(root, { shadowMode: true, onSelectionComplete });

    overlay.start();
    expect(document.body.appendChild).toHaveBeenCalled();

    overlay.stop();
    // Verify that stop cleans up resources
    expect(overlay['overlayContainer']).toBeNull();
  });
});
