import { describe, expect, test } from 'vitest';
import { isPdfUrl, shouldUseExtensionPdfViewer } from '../src/background/pdf-redirect';

describe('PDF redirect logic', () => {
  test('detects PDF URLs by path', () => {
    expect(isPdfUrl('https://example.com/manual.pdf')).toBe(true);
    expect(isPdfUrl('https://example.com/manual.pdf?download=1')).toBe(true);
    expect(isPdfUrl('https://example.com/manual')).toBe(false);
  });

  test('redirects local file PDFs so their text can be translated', () => {
    expect(shouldUseExtensionPdfViewer('file:///C:/Users/Admin/Downloads/manual.pdf')).toBe(true);
  });

  test('redirects web PDFs but not extension pages', () => {
    expect(shouldUseExtensionPdfViewer('https://example.com/manual.pdf')).toBe(true);
    expect(shouldUseExtensionPdfViewer('chrome-extension://abc/pdf-viewer/viewer.html?file=https%3A%2F%2Fexample.com%2Fmanual.pdf')).toBe(false);
  });
});
