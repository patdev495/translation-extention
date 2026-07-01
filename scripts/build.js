import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'fs';

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
    },
    tsconfig: resolve(__dirname, '../tsconfig.json'),
  });
  if (swResult.errors.length > 0) {
    throw new Error(`Service worker build failed: ${swResult.errors[0].text}`);
  }
  const swSize = (await import('fs')).statSync(resolve(distPath, 'service-worker.js')).size;
  console.log(`dist/service-worker.js  ${(swSize / 1024).toFixed(2)} kB`);

  // 4. Build PDF Viewer
  console.log('\n--- Building PDF Viewer ---');
  await build({
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          viewer: resolve(__dirname, '../src/pdf-viewer/viewer.html'),
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
    rmSync(resolve(distPath, 'src'), { recursive: true, force: true });
    console.log('Moved viewer.html → dist/pdf-viewer/viewer.html');
  }

  // 5. Copy PDF.js files to dist/
  console.log('\n--- Copying PDF.js files ---');
  const pdfSrc = resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.min.mjs');
  const workerSrc = resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  copyFileSync(pdfSrc, resolve(distPath, 'pdf.min.mjs'));
  copyFileSync(workerSrc, resolve(distPath, 'pdf.worker.min.mjs'));
  console.log('Copied pdf.min.mjs + pdf.worker.min.mjs → dist/');

  console.log('\nBuild completed successfully!');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});

