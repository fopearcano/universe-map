import { defineConfig } from 'vite';

// Static single-page app. `public/` (the preprocessed catalog) is served at the
// site root and copied verbatim into the build.
export default defineConfig({
  base: './',
  server: { port: 5333, strictPort: true, host: true },
  preview: { port: 5333, strictPort: true, host: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
