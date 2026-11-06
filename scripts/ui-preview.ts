import type { Plugin } from 'vite';

function samplePdf(): Buffer {
  const text = 'BT /F1 24 Tf 54 740 Td (PolyTranslate) Tj /F1 14 Tf 0 -40 Td (Translate English, Vietnamese and Chinese.) Tj 0 -28 Td (Select text to read its translation and pronunciation.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

export function extensionPreview(): Plugin {
  return {
    name: 'polytranslate-development-preview',
    apply: 'serve',
    transformIndexHtml(html, context) {
      if (!['/popup/index.html', '/src/pdf-viewer/viewer.html', '/scripts/overlay-preview.html'].includes(context.path)) return html;
      return {
        html,
        tags: [{ tag: 'script', attrs: { src: '/scripts/extension-preview.js' }, injectTo: 'head-prepend' }],
      };
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/__preview__/sample.pdf') return next();
        response.setHeader('Content-Type', 'application/pdf');
        response.end(samplePdf());
      });
    },
  };
}
