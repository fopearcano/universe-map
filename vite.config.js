import { defineConfig } from 'vite';

// Static single-page app. `public/` (the preprocessed catalog) is served at the
// site root and copied verbatim into the build.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
