import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fixReactImport } from './vite-plugin-fix-react-import';

export default defineConfig({
  plugins: [
    fixReactImport(),
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer',
    },
    dedupe: ['react', 'react-dom'],
    conditions: ['import', 'module', 'browser', 'default'],
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    include: ['buffer', 'process', 'react', 'react-dom', 'zustand'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    commonjsOptions: {
      include: [/buffer/, /process/, /zustand/, /tonweb/, /@ton/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
      plugins: [
        {
          name: 'fix-zustand-imports',
          transform(code, id) {
            if (id.includes('zustand') && (id.includes('/esm/') || id.endsWith('.mjs'))) {
              let modified = code;
              let changed = false;
              
              // Fix React import
              if (code.includes('import ReactExports from')) {
                modified = modified.replace(
                  /import\s+ReactExports\s+from\s+['"]react['"]/g,
                  "import * as ReactExports from 'react'"
                );
                changed = true;
              }
              
              // Fix use-sync-external-store import
              if (code.includes('import useSyncExternalStoreExports from')) {
                modified = modified.replace(
                  /import\s+useSyncExternalStoreExports\s+from\s+['"]use-sync-external-store\/shim\/with-selector\.js['"]/g,
                  "import * as useSyncExternalStoreExports from 'use-sync-external-store/shim/with-selector.js'"
                );
                changed = true;
              }
              
              if (changed) {
                return {
                  code: modified,
                  map: null,
                };
              }
            }
            return null;
          },
        },
      ],
    },
  },
});



