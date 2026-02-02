/**
 * Security utilities
 * Provides functions for secure password comparison, logging, etc.
 */

/**
 * Constant-time string comparison to prevent timing attacks
 * Compares two strings in constant time regardless of where they differ
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still perform comparison to maintain constant time
    let result = 0;
    const maxLength = Math.max(a.length, b.length);
    for (let i = 0; i < maxLength; i++) {
      result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Secure password comparison with timing attack protection
 */
export async function securePasswordCompare(
  inputPassword: string,
  storedHash: string,
  verifyFunction: (password: string, hash: string) => Promise<boolean>
): Promise<boolean> {
  const startTime = performance.now();
  
  try {
    const isValid = await verifyFunction(inputPassword, storedHash);
    
    // Add constant delay to prevent timing attacks
    const elapsed = performance.now() - startTime;
    const minDelay = 100; // Minimum 100ms delay
    if (elapsed < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
    }
    
    return isValid;
  } catch (error) {
    // Always delay even on error
    const elapsed = performance.now() - startTime;
    const minDelay = 100;
    if (elapsed < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
    }
    return false;
  }
}

/**
 * Security logger - logs security events without sensitive data
 */
class SecurityLogger {
  private logs: Array<{ timestamp: number; event: string; details: Record<string, any> }> = [];
  private maxLogs = 100;

  /**
   * Logs a security event
   */
  log(event: string, details: Record<string, any> = {}): void {
    // Remove sensitive data from details
    const sanitizedDetails = this.sanitizeDetails(details);
    
    const logEntry = {
      timestamp: Date.now(),
      event,
      details: sanitizedDetails,
    };

    this.logs.push(logEntry);
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log('[Security]', event, sanitizedDetails);
    }
  }

  /**
   * Sanitizes details to remove sensitive information
   */
  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'password',
      'privateKey',
      'seedPhrase',
      'seed',
      'mnemonic',
      'secret',
      'token',
      'apiKey',
    ];

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 100) {
        // Truncate long strings
        sanitized[key] = value.substring(0, 50) + '...';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeDetails(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Gets recent security logs
   */
  getLogs(limit: number = 10): Array<{ timestamp: number; event: string; details: Record<string, any> }> {
    return this.logs.slice(-limit);
  }

  /**
   * Clears all logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

export const securityLogger = new SecurityLogger();

/**
 * Rate limiter for API requests
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Checks if a request is allowed
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  /**
   * Gets time until next request is allowed (in ms)
   */
  getTimeUntilNext(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < this.windowMs);

    if (validRequests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = validRequests[0];
    return this.windowMs - (now - oldestRequest);
  }

  /**
   * Clears rate limit for a key
   */
  clear(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clears all rate limits
   */
  clearAll(): void {
    this.requests.clear();
  }
}

export const rateLimiter = new RateLimiter(60000, 10); // 10 requests per minute
