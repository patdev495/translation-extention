export const PDF_VIEWER_PATH = 'pdf-viewer/viewer.html';

/**
 * Returns true if the URL's path ends in a PDF filename.
 * This alone does not prove that a web response contains a PDF.
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
 * Local PDFs can be detected before navigation. Web URLs must wait for response
 * headers: preview pages (such as GitHub blob URLs) can also end in .pdf.
 */
export function shouldUseExtensionPdfViewer(url: string, contentType?: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return isPdfUrl(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

    const mimeType = contentType?.split(';')[0].trim().toLowerCase();
    return mimeType === 'application/pdf'
      || (mimeType === 'application/octet-stream' && isPdfUrl(url));
  } catch {
    return false;
  }
}
