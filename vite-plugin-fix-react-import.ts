/**
 * Vite plugin to fix React and use-sync-external-store import issues with zustand
 */
import type { Plugin } from 'vite';

export function fixReactImport(): Plugin {
  return {
    name: 'fix-react-import',
    enforce: 'pre',
    resolveId(id) {
      // Never intercept React - let it resolve normally
      if (id === 'react' || id === 'react-dom' || id.startsWith('react/') || id.startsWith('react-dom/')) {
        return null;
      }
      return null;
    },
    transform(code, id) {
      // Fix zustand imports in the ESM bundle
      if (id.includes('zustand') && (id.endsWith('.mjs') || id.includes('/esm/'))) {
        let modified = code;
        let changed = false;
        
        // Fix React import - replace default import with namespace import
        if (code.includes('import ReactExports from')) {
          modified = modified.replace(
            /import\s+ReactExports\s+from\s+['"]react['"]/g,
            "import * as ReactExports from 'react'"
          );
          changed = true;
        }
        
        // Fix use-sync-external-store import - replace default import with namespace import
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
            map: { mappings: '' },
          };
        }
      }
      return null;
    },
  };
}

