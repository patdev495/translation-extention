import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', './popup/**/*.{ts,tsx}', './src/**/*.html'],
  darkMode: 'class',
} satisfies Config;
