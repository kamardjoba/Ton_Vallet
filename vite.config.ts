import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { fixReactImport } from './vite-plugin-fix-react-import';

export default defineConfig({
  plugins: [
    // React plugin should be first to handle JSX properly
    react({
      jsxRuntime: 'automatic',
    }),
    {
      name: 'virtual-node-modules',
      enforce: 'pre',
      resolveId(id, importer) {
        // NEVER intercept React or React DOM - always let default resolution handle it FIRST
        if (
          id === 'react' || 
          id === 'react-dom' || 
          id.startsWith('react/') || 
          id.startsWith('react-dom/') ||
          id.startsWith('@vitejs/') ||
          id.startsWith('vite/')
        ) {
          return null;
        }
        // Don't intercept anything from our source files
        if (importer && (importer.includes('/src/') || importer.includes('\\src\\'))) {
          return null;
        }
        // Don't intercept zustand or @ton packages
        if (
          id.startsWith('zustand') ||
          id.startsWith('@ton/')
        ) {
          return null;
        }
        // Intercept events module - use our virtual module
        // This is handled by events-resolver-rollup in build, but we need it here too for dev
        if (id === 'events') {
          return {
            id: '\0virtual:events',
            moduleSideEffects: false,
          };
        }
        if (id === 'semver') {
          return '\0virtual:semver';
        }
        // Stub all @ledgerhq modules - not needed for browser
        if (id.includes('@ledgerhq')) {
          return '\0stub:' + id;
        }
        return null;
      },
      load(id) {
        // Provide events module with both default and named exports
        if (id === '\0virtual:events') {
          return `
            class EventEmitter {
              constructor() {
                this._events = {};
              }
              on(event, listener) {
                if (!this._events[event]) this._events[event] = [];
                this._events[event].push(listener);
                return this;
              }
              off(event, listener) {
                if (!this._events[event]) return this;
                this._events[event] = this._events[event].filter(l => l !== listener);
                return this;
              }
              emit(event, ...args) {
                if (!this._events[event]) return false;
                this._events[event].forEach(listener => listener(...args));
                return true;
              }
              once(event, listener) {
                const onceWrapper = (...args) => {
                  listener(...args);
                  this.off(event, onceWrapper);
                };
                return this.on(event, onceWrapper);
              }
              addListener(event, listener) { return this.on(event, listener); }
              removeListener(event, listener) { return this.off(event, listener); }
              removeAllListeners(event) {
                if (event) delete this._events[event];
                else this._events = {};
                return this;
              }
            }
            // Export both named and default for compatibility
            export { EventEmitter };
            export default EventEmitter;
            // Also export as CommonJS for compatibility
            if (typeof module !== 'undefined' && module.exports) {
              module.exports = EventEmitter;
              module.exports.EventEmitter = EventEmitter;
            }
          `;
        }
        // Provide semver module stub (not used in browser)
        if (id === '\0virtual:semver') {
          return `
            const semver = {
              satisfies: () => true,
              valid: () => true,
              compare: () => 0,
            };
            export default semver;
            export { semver };
          `;
        }
        // Stub all @ledgerhq modules
        if (id.startsWith('\0stub:')) {
          const originalId = id.replace('\0stub:', '');
          // Provide better stubs for specific modules
          if (originalId.includes('@ledgerhq/devices')) {
            // Handle submodules
            if (originalId.includes('/lib/ble/sendAPDU')) {
              return 'export const sendAPDU = () => Promise.resolve(Buffer.alloc(0)); export default sendAPDU;';
            }
            if (originalId.includes('/lib/ble/receiveAPDU')) {
              return 'export const receiveAPDU = () => Promise.resolve(Buffer.alloc(0)); export default receiveAPDU;';
            }
            if (originalId.includes('/lib/hid-framing')) {
              return 'export default { send: () => {}, receive: () => {} };';
            }
            return `
              export const ledgerUSBVendorId = 0x2c97;
              export const identifyUSBProductId = () => null;
              export const getBluetoothServiceUuids = () => [];
              export const getInfosForServiceUuid = () => null;
              export default {};
            `;
          }
          if (originalId.includes('@ledgerhq/logs')) {
            return `
              export const log = () => {};
              export default { log };
            `;
          }
          if (originalId.includes('@ledgerhq/errors')) {
            return `
              export class TransportOpenUserCancelled extends Error {}
              export class TransportInterfaceNotAvailable extends Error {}
              export class TransportWebUSBGestureRequired extends Error {}
              export class DisconnectedDeviceDuringOperation extends Error {}
              export class DisconnectedDevice extends Error {}
              export class TransportError extends Error {}
              export class TransportStatusError extends Error {}
              export default {};
            `;
          }
          if (originalId.includes('@ledgerhq/hw-transport')) {
            return `
              export class Transport {
                constructor() {}
                send() { return Promise.resolve(Buffer.alloc(0)); }
                close() { return Promise.resolve(); }
              }
              export default Transport;
            `;
          }
          if (originalId.includes('@ledgerhq/hw-transport-webusb')) {
            return `
              export const getLedgerDevices = () => Promise.resolve([]);
              export const getFirstLedgerDevice = () => Promise.resolve(null);
              export const requestLedgerDevice = () => Promise.resolve(null);
              export const isSupported = () => false;
              export default {};
            `;
          }
          if (originalId.includes('@ledgerhq/hw-transport-web-ble')) {
            return `
              export const createTransport = () => Promise.resolve(null);
              export const listen = () => ({ unsubscribe: () => {} });
              export default {};
            `;
          }
          return 'export default {};';
        }
        return null;
      },
    },
    nodePolyfills({
      // Enable polyfills for buffer, process (events handled by virtual module)
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Exclude events - we handle it with virtual module
      exclude: ['events'],
    }),
    fixReactImport(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
    // Ensure React is resolved correctly
    preserveSymlinks: false,
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    // Force React to be included in optimization
    force: false,
  },
  build: {
    commonjsOptions: {
      // Transform ALL CommonJS modules, including nested ones
      include: [/node_modules/],
      transformMixedEsModules: true,
      // Ensure React CommonJS is properly transformed
      requireReturnsDefault: 'auto',
      // Enable named exports detection for React
      esmExternals: false,
      // Strict mode for better CommonJS handling
      strictRequires: true,
    },
    rollupOptions: {
      // External React to ensure proper resolution
      external: [],
      output: {
        manualChunks: undefined,
        // Use ES format for modern browsers (better for Telegram Mini App)
        format: 'es',
        // Don't preserve modules - bundle everything
        preserveModules: false,
      },
      plugins: [
        {
          name: 'react-resolver-rollup',
          enforce: 'pre',
          resolveId(id) {
            // Explicitly handle React imports - don't let other plugins interfere
            if (id === 'react' || id === 'react-dom') {
              // Return null to let Rollup resolve it normally
              return null;
            }
            return null;
          },
        },
        {
          name: 'events-resolver-rollup',
          enforce: 'pre',
          resolveId(id, importer) {
            // Intercept ALL events imports FIRST - before any other resolution
            // This includes imports from node_modules like @ledgerhq/hw-transport
            if (id === 'events') {
              return {
                id: '\0virtual:events',
                moduleSideEffects: false,
              };
            }
            return null;
          },
          load(id) {
            if (id === '\0virtual:events') {
              return `
                class EventEmitter {
                  constructor() {
                    this._events = {};
                  }
                  on(event, listener) {
                    if (!this._events[event]) this._events[event] = [];
                    this._events[event].push(listener);
                    return this;
                  }
                  off(event, listener) {
                    if (!this._events[event]) return this;
                    this._events[event] = this._events[event].filter(l => l !== listener);
                    return this;
                  }
                  emit(event, ...args) {
                    if (!this._events[event]) return false;
                    this._events[event].forEach(listener => listener(...args));
                    return true;
                  }
                  once(event, listener) {
                    const onceWrapper = (...args) => {
                      listener(...args);
                      this.off(event, onceWrapper);
                    };
                    return this.on(event, onceWrapper);
                  }
                  addListener(event, listener) { return this.on(event, listener); }
                  removeListener(event, listener) { return this.off(event, listener); }
                  removeAllListeners(event) {
                    if (event) delete this._events[event];
                    else this._events = {};
                    return this;
                  }
                }
                // Export both named and default for compatibility
                export { EventEmitter };
                export default EventEmitter;
                // Also export as CommonJS for compatibility
                if (typeof module !== 'undefined' && module.exports) {
                  module.exports = EventEmitter;
                  module.exports.EventEmitter = EventEmitter;
                }
              `;
            }
            return null;
          },
        },
        {
          name: 'virtual-node-modules-rollup',
          // Don't use enforce: 'pre' to let React resolve first
          resolveId(id, importer) {
            // NEVER intercept React or React DOM - always let default resolution handle it FIRST
            if (id === 'react' || id === 'react-dom' || id.startsWith('react/') || id.startsWith('react-dom/')) {
              return null;
            }
            // Don't intercept anything from our source files
            if (importer && (importer.includes('/src/') || importer.includes('\\src\\'))) {
              return null;
            }
            // Events are handled by events-resolver-rollup plugin
            if (id === 'semver') {
              return '\0virtual:semver';
            }
            // Stub all @ledgerhq modules - not needed for browser
            if (id.includes('@ledgerhq')) {
              return '\0stub:' + id;
            }
            return null;
          },
          load(id) {
            // Events are handled by events-resolver-rollup plugin
            // Provide semver module stub (not used in browser)
            if (id === '\0virtual:semver') {
              return `
                const semver = {
                  satisfies: () => true,
                  valid: () => true,
                  compare: () => 0,
                };
                export default semver;
                export { semver };
              `;
            }
            // Stub all @ledgerhq modules
            if (id.startsWith('\0stub:')) {
              const originalId = id.replace('\0stub:', '');
              // Provide better stubs for specific modules
              if (originalId.includes('@ledgerhq/devices')) {
                // Handle submodules
                if (originalId.includes('/lib/ble/sendAPDU')) {
                  return 'export const sendAPDU = () => Promise.resolve(Buffer.alloc(0)); export default sendAPDU;';
                }
                if (originalId.includes('/lib/ble/receiveAPDU')) {
                  return 'export const receiveAPDU = () => Promise.resolve(Buffer.alloc(0)); export default receiveAPDU;';
                }
                if (originalId.includes('/lib/hid-framing')) {
                  return 'export default { send: () => {}, receive: () => {} };';
                }
                return `
                  export const ledgerUSBVendorId = 0x2c97;
                  export const identifyUSBProductId = () => null;
                  export const getBluetoothServiceUuids = () => [];
                  export const getInfosForServiceUuid = () => null;
                  export default {};
                `;
              }
              if (originalId.includes('@ledgerhq/logs')) {
                return `
                  export const log = () => {};
                  export default { log };
                `;
              }
              if (originalId.includes('@ledgerhq/errors')) {
                return `
                  export class TransportOpenUserCancelled extends Error {}
                  export class TransportInterfaceNotAvailable extends Error {}
                  export class TransportWebUSBGestureRequired extends Error {}
                  export class DisconnectedDeviceDuringOperation extends Error {}
                  export class DisconnectedDevice extends Error {}
                  export class TransportError extends Error {}
                  export class TransportStatusError extends Error {}
                  export default {};
                `;
              }
              if (originalId.includes('@ledgerhq/hw-transport')) {
                return `
                  export class Transport {
                    constructor() {}
                    send() { return Promise.resolve(Buffer.alloc(0)); }
                    close() { return Promise.resolve(); }
                  }
                  export default Transport;
                `;
              }
              if (originalId.includes('@ledgerhq/hw-transport-webusb')) {
                return `
                  export const getLedgerDevices = () => Promise.resolve([]);
                  export const getFirstLedgerDevice = () => Promise.resolve(null);
                  export const requestLedgerDevice = () => Promise.resolve(null);
                  export const isSupported = () => false;
                  export default {};
                `;
              }
              if (originalId.includes('@ledgerhq/hw-transport-web-ble')) {
                return `
                  export const createTransport = () => Promise.resolve(null);
                  export const listen = () => ({ unsubscribe: () => {} });
                  export default {};
                `;
              }
              return 'export default {};';
            }
            return null;
          },
        },
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



