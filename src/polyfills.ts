/**
 * Polyfills for Node.js APIs in browser environment
 * Required for tonweb library to work in browser
 */

// Create Buffer polyfill implementation for browser
// Vite externalizes 'buffer' module, so we use our own implementation
// This Buffer extends Uint8Array to be fully compatible with @ton/crypto
class BufferPolyfill extends Uint8Array {
  toString(encoding?: 'hex' | 'utf8'): string {
    if (encoding === 'hex') {
      return Array.from(this)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return new TextDecoder().decode(this);
  }
}

// Add static methods to BufferPolyfill
(BufferPolyfill as any).from = function(data: string | ArrayLike<number>, encoding?: 'hex' | 'utf8'): BufferPolyfill {
  let bytes: Uint8Array;
  
  if (typeof data === 'string') {
    if (encoding === 'hex') {
      bytes = new Uint8Array(
        data.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
    } else {
      const encoder = new TextEncoder();
      bytes = encoder.encode(data);
    }
  } else {
    bytes = new Uint8Array(data);
  }
  
  // Create instance and set prototype
  const buffer = new BufferPolyfill(bytes.length);
  buffer.set(bytes);
  return buffer;
};

(BufferPolyfill as any).alloc = function(size: number): BufferPolyfill {
  return new BufferPolyfill(size);
};

const Buffer = BufferPolyfill as any;

// Create minimal process polyfill
const processPolyfill = {
  env: {},
  nextTick: (fn: () => void) => setTimeout(fn, 0),
  browser: true,
};

// Extend Window interface
declare global {
  interface Window {
    Buffer: any;
    process: any;
  }
}

// Make Buffer and process available globally
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = processPolyfill;
}

// Also set global for Node.js-like environments
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).process = processPolyfill;
}

export { Buffer, processPolyfill as process };

