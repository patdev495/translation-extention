import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Simple default fallback configuration
export default defineConfig({
  plugins: [tailwindcss()],
});
