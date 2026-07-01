export const PDF_VIEWER_PATH = 'pdf-viewer/viewer.html';

/**
 * Returns true if the URL looks like a PDF by its path/query.
 */
export function isPdfUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /\.pdf(\?.*)?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Extension pages should not be redirected again, but local file PDFs still
 * need the extension viewer so their text can be translated.
 */
export function shouldUseExtensionPdfViewer(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'chrome-extension:') return false;
    return isPdfUrl(url);
  } catch {
    return false;
  }
}
