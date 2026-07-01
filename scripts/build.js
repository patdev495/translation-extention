import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

  // 3. Build Service Worker (IIFE format)
  console.log('\n--- Building Service Worker (IIFE) ---');
  await build({
    build: {
      rollupOptions: {
        input: {
          background: resolve(__dirname, '../src/background/service-worker.ts'),
        },
        output: {
          entryFileNames: 'service-worker.js',
          format: 'iife',
        },
      },
      outDir: distPath,
      emptyOutDir: false,
    },
  });

  console.log('\nBuild completed successfully!');
}

runBuild().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
