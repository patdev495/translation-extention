import { describe, test, expect, vi, beforeEach } from 'vitest';
import { OcrSelectionOverlay } from '../src/content/ocr-selection-overlay';

// Mock DOM environment minimally
const mockDocumentListeners: Record<string, Function[]> = {};
const mockWindowListeners: Record<string, Function[]> = {};
let createdElements: any[] = [];

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
    const element = {
      tagName,
      className: '',
      style: {},
      children: [] as any[],
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 1024,
        height: 768,
      })),
      clientWidth: 1024,
      clientHeight: 768,
      attachShadow: vi.fn(() => {
        const shadow: {
          children: any[];
          appendChild: any;
          querySelector: any;
        } = {
          children: [] as any[],
          appendChild: vi.fn((child: any) => {
            shadow.children.push(child);
          }),
          querySelector: vi.fn((selector: string) => shadow.children.find((child: any) => child.className === selector.slice(1)) ?? null),
        };
        return shadow;
      }),
      appendChild: vi.fn((child: any) => {
        element.children.push(child);
      }),
      remove: vi.fn(),
      addEventListener: vi.fn((event: string, callback: Function) => {
        element[`on${event}`] = callback;
      }),
      removeEventListener: vi.fn(),
    } as any;
    createdElements.push(element);
    return element;
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
    createdElements = [];
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

  test('draws webpage OCR selection in overlay-local coordinates when overlay root is offset', () => {
    const root = document.createElement('div');
    const onSelectionComplete = vi.fn();
    const overlay = new OcrSelectionOverlay(root, { shadowMode: true, onSelectionComplete });

    overlay.start();

    const overlayContainer = createdElements.find((element) => element.id === 'polytranslate-ocr-overlay-root');
    overlayContainer.getBoundingClientRect.mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 300,
    });
    overlayContainer.clientWidth = 400;
    overlayContainer.clientHeight = 300;

    const overlayElement = (overlay['shadow'] as any).children.find((child: any) => child.className === 'overlay');
    overlayElement.onmousedown({
      button: 0,
      clientX: 150,
      clientY: 90,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    overlayElement.onmousemove({
      clientX: 250,
      clientY: 170,
      preventDefault: vi.fn(),
    });

    const selectionBox = overlay['selectionBox']!;
    expect(selectionBox.style.left).toBe('50px');
    expect(selectionBox.style.top).toBe('40px');
    expect(selectionBox.style.width).toBe('100px');
    expect(selectionBox.style.height).toBe('80px');
  });
});
