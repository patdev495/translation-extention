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

  test('waits for response headers before redirecting web URLs ending in .pdf', () => {
    expect(shouldUseExtensionPdfViewer('https://example.com/manual.pdf')).toBe(false);
  });

  test('leaves HTML preview and error pages in the browser', () => {
    const githubPreview = 'https://github.com/huyubing/books-pdf/blob/master/计算机程序的构造和解释（SICP中文第2版）.pdf';
    expect(shouldUseExtensionPdfViewer(githubPreview, 'text/html; charset=utf-8')).toBe(false);
    expect(shouldUseExtensionPdfViewer('https://example.com/manual.pdf', 'text/plain')).toBe(false);
  });

  test('redirects PDF responses with or without a PDF filename', () => {
    expect(shouldUseExtensionPdfViewer('https://example.com/manual.pdf', 'application/pdf')).toBe(true);
    expect(shouldUseExtensionPdfViewer('https://example.com/download?id=1', 'Application/PDF; charset=binary')).toBe(true);
  });

  test('supports PDFs served as binary downloads', () => {
    expect(shouldUseExtensionPdfViewer('https://example.com/manual.pdf?raw=true', 'application/octet-stream')).toBe(true);
    expect(shouldUseExtensionPdfViewer('https://example.com/archive.zip', 'application/octet-stream')).toBe(false);
  });

  test('does not redirect extension pages', () => {
    expect(shouldUseExtensionPdfViewer('chrome-extension://abc/pdf-viewer/viewer.html?file=https%3A%2F%2Fexample.com%2Fmanual.pdf')).toBe(false);
    expect(shouldUseExtensionPdfViewer('chrome-extension://abc/manual.pdf', 'application/pdf')).toBe(false);
  });
});
