import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// `base` is set for GitHub Pages project sites (https://<user>.github.io/<repo>/).
// Override with BASE_PATH=/ for root deployments or local static hosting.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/project_diplomovka/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
