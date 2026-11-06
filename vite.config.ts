import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { extensionPreview } from './scripts/ui-preview';

// Simple default fallback configuration
export default defineConfig({
  plugins: [tailwindcss(), extensionPreview()],
});
