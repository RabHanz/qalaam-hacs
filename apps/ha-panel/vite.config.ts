import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

/**
 * Build the panel as a single ES module that HA loads via `add_extra_js_url`.
 * Preact (3 KB) keeps the bundle slim — important since HA caches per repo.
 */
export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/panel.tsx',
      formats: ['es'],
      fileName: () => 'qalaam-panel.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
    sourcemap: true,
    target: 'es2022',
  },
});
