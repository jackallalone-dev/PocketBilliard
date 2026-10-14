import { defineConfig } from 'vite';
import { pwaPlugin } from './scripts/pwa-plugin.js';

export default defineConfig({
  // Resolve built assets beside index.html, including GitHub Pages subpaths.
  base: './',
  plugins: [pwaPlugin()],
});
