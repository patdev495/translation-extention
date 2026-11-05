import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runBuild() {
  const distPath = resolve(__dirname, '../dist');

  // 1. Build Popup
  console.log('\n--- Building Popup ---');
  await build({
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          popup: resolve(__dirname, '../popup/index.html'),
        },
        output: {
          entryFileNames: 'popup/[name].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'popup.css';
            }
            return 'assets/[name]-[hash].[ext]';
          },
        },
      },
      outDir: distPath,
      emptyOutDir: true,
    },
  });

  // 2. Build Content Script (IIFE format)
  console.log('\n--- Building Content Script (IIFE) ---');
  await build({
    build: {
      rollupOptions: {
        input: {
          content: resolve(__dirname, '../src/content/content-script.ts'),
        },
        output: {
          entryFileNames: 'content-script.js',
          format: 'iife',
        },
      },
      outDir: distPath,
      emptyOutDir: false,
    },
  });

  // 3. Build Service Worker (esbuild — fast, handles large deps like pinyin-pro)
  console.log('\n--- Building Service Worker ---');
  const esbuild = await import('esbuild');
  const swResult = await esbuild.build({
    entryPoints: [resolve(__dirname, '../src/background/service-worker.ts')],
    bundle: true,
    format: 'iife',
    outfile: resolve(distPath, 'service-worker.js'),
    platform: 'browser',
    target: 'es2022',
    minify: true,
    logLevel: 'silent',
    define: {
      'process.env.NODE_ENV': '"production"',
      '__LEARNING_API_BASE__': JSON.stringify(process.env.LEARNING_API_BASE || 'http://127.0.0.1:8000'),
    },
    tsconfig: resolve(__dirname, '../tsconfig.json'),
  });
  if (swResult.errors.length > 0) {
    throw new Error(`Service worker build failed: ${swResult.errors[0].text}`);
  }
  const swSize = (await import('fs')).statSync(resolve(distPath, 'service-worker.js')).size;
  console.log(`dist/service-worker.js  ${(swSize / 1024).toFixed(2)} kB`);

  // 4. Build PDF Viewer & Offscreen Document
  console.log('\n--- Building PDF Viewer & Offscreen Document ---');
  await build({
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          viewer: resolve(__dirname, '../src/pdf-viewer/viewer.html'),
          offscreen: resolve(__dirname, '../src/offscreen/offscreen.html'),
        },
        output: {
          entryFileNames: 'pdf-viewer/[name].js',
          chunkFileNames: 'pdf-viewer/chunks/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'pdf-viewer/viewer.css';
            }
            return 'pdf-viewer/assets/[name]-[hash].[ext]';
          },
        },
      },
      outDir: distPath,
      emptyOutDir: false,
    },
  });

  // Move viewer.html from dist/src/pdf-viewer/ → dist/pdf-viewer/
  const viewerHtmlSrc = resolve(distPath, 'src/pdf-viewer/viewer.html');
  const viewerHtmlDst = resolve(distPath, 'pdf-viewer/viewer.html');
  if (existsSync(viewerHtmlSrc)) {
    mkdirSync(resolve(distPath, 'pdf-viewer'), { recursive: true });
    renameSync(viewerHtmlSrc, viewerHtmlDst);
    console.log('Moved viewer.html → dist/pdf-viewer/viewer.html');
  }

  // Move offscreen.html from dist/src/offscreen/ → dist/offscreen.html
  const offscreenHtmlSrc = resolve(distPath, 'src/offscreen/offscreen.html');
  const offscreenHtmlDst = resolve(distPath, 'offscreen.html');
  if (existsSync(offscreenHtmlSrc)) {
    renameSync(offscreenHtmlSrc, offscreenHtmlDst);
    console.log('Moved offscreen.html → dist/offscreen.html');
  }

  // Clean up dist/src/
  if (existsSync(resolve(distPath, 'src'))) {
    rmSync(resolve(distPath, 'src'), { recursive: true, force: true });
    console.log('Cleaned up dist/src/');
  }

  // 5. Copy PDF.js files to dist/
  console.log('\n--- Copying PDF.js files ---');
  const pdfSrc = resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.min.mjs');
  const workerSrc = resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  copyFileSync(pdfSrc, resolve(distPath, 'pdf.min.mjs'));
  copyFileSync(workerSrc, resolve(distPath, 'pdf.worker.min.mjs'));
  console.log('Copied pdf.min.mjs + pdf.worker.min.mjs → dist/');

  // 6. Copy ONNX Runtime Web WASM assets for extension-local OCR inference.
  console.log('\n--- Copying ONNX Runtime Web assets ---');
  const ortSrcDir = resolve(__dirname, '../node_modules/onnxruntime-web/dist');
  const ortDstDir = resolve(distPath, 'onnxruntime-web');
  mkdirSync(ortDstDir, { recursive: true });
  for (const file of readdirSync(ortSrcDir)) {
    if ((file.endsWith('.wasm') || file.endsWith('.mjs')) && 
        !file.includes('asyncify') && 
        !file.includes('jspi')) {
      copyFileSync(resolve(ortSrcDir, file), resolve(ortDstDir, file));
    }
  }
  console.log('Copied ONNX Runtime Web WASM assets to dist/onnxruntime-web/');

  // 7. Copy stroke data by character so content scripts can load it offline on demand.
  console.log('\n--- Copying Hanzi stroke data ---');
  const hanziSrcDir = resolve(__dirname, '../node_modules/hanzi-writer-data');
  const hanziDstDir = resolve(distPath, 'hanzi-data');
  mkdirSync(hanziDstDir, { recursive: true });
  let hanziCount = 0;
  for (const file of readdirSync(hanziSrcDir)) {
    if (!file.endsWith('.json')) continue;
    const character = file.slice(0, -'.json'.length);
    if ([...character].length !== 1) continue;
    const codePoint = character.codePointAt(0).toString(16).toUpperCase();
    copyFileSync(resolve(hanziSrcDir, file), resolve(hanziDstDir, `${codePoint}.json`));
    hanziCount++;
  }
  copyFileSync(resolve(hanziSrcDir, 'ARPHICPL.TXT'), resolve(hanziDstDir, 'ARPHICPL.TXT'));
  const licenseDir = resolve(distPath, 'licenses');
  mkdirSync(licenseDir, { recursive: true });
  copyFileSync(resolve(__dirname, '../node_modules/hanzi-writer/LICENSE'), resolve(licenseDir, 'hanzi-writer-MIT.txt'));
  copyFileSync(resolve(__dirname, '../node_modules/hanzi-writer/COPYING.md'), resolve(licenseDir, 'hanzi-writer-attribution.md'));
  console.log(`Copied ${hanziCount} Hanzi characters + license to dist/hanzi-data/`);

  // 8. Package Make Me a Hanzi dictionary records separately from stroke graphics.
  const dictionarySource = resolve(__dirname, '../third_party/makemeahanzi');
  const dictionaryDest = resolve(distPath, 'hanzi-dictionary');
  mkdirSync(dictionaryDest, { recursive: true });
  let dictionaryCount = 0;
  for (const line of readFileSync(resolve(dictionarySource, 'dictionary.txt'), 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    const record = JSON.parse(line);
    if ([...record.character].length !== 1) continue;
    const codePoint = record.character.codePointAt(0).toString(16).toUpperCase();
    writeFileSync(resolve(dictionaryDest, `${codePoint}.json`), JSON.stringify(record));
    dictionaryCount++;
  }
  copyFileSync(resolve(dictionarySource, 'LGPL'), resolve(licenseDir, 'makemeahanzi-LGPL.txt'));
  copyFileSync(resolve(dictionarySource, 'COPYING'), resolve(licenseDir, 'makemeahanzi-COPYING.txt'));
  copyFileSync(resolve(dictionarySource, 'dictionary.txt'), resolve(licenseDir, 'makemeahanzi-dictionary-source.txt'));
  copyFileSync(resolve(dictionarySource, 'PROVENANCE.md'), resolve(licenseDir, 'makemeahanzi-PROVENANCE.md'));
  console.log(`Packaged ${dictionaryCount} Hanzi dictionary records`);

  console.log('\nBuild completed successfully!');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
