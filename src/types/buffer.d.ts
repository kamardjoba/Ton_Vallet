/**
 * Type declarations for buffer polyfill
 */

declare module 'buffer' {
  export class Buffer extends Uint8Array {
    static from(data: string | ArrayLike<number>, encoding?: 'hex' | 'utf8'): Buffer;
    static alloc(size: number): Buffer;
    toString(encoding?: 'hex' | 'utf8'): string;
  }
  export { Buffer as default };
}



