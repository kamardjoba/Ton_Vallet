/**
 * Debug utilities for Telegram Mini App
 * Helps with debugging on mobile devices
 */

/**
 * Shows debug info in Telegram Mini App
 * Can be called from browser console or displayed to user
 */
export function showDebugInfo(message: string, data?: any) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // Only log to console, don't show alerts to user
  console.log(logMessage, data || '');
  
  // Also log to console with more details
  if (data) {
    console.log('Debug data:', data);
  }
}

/**
 * Logs error with full context
 */
export function logError(context: string, error: any) {
  const errorInfo = {
    context,
    name: error?.name,
    message: error?.message,
    stack: error?.stack,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    platform: typeof window !== 'undefined' && window.Telegram?.WebApp?.platform,
    timestamp: new Date().toISOString(),
  };
  
  console.error(`[ERROR] ${context}:`, errorInfo);
  
  // Don't show alerts to user, only log to console
  // User will see error in UI if needed
  
  return errorInfo;
}

/**
 * Gets environment info for debugging
 */
export function getEnvironmentInfo() {
  const info = {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    platform: typeof window !== 'undefined' && window.Telegram?.WebApp?.platform || 'unknown',
    version: typeof window !== 'undefined' && window.Telegram?.WebApp?.version || 'unknown',
    hasWebAuthn: typeof window !== 'undefined' && !!window.PublicKeyCredential,
    hasTelegram: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
    location: typeof window !== 'undefined' ? window.location.href : 'unknown',
    timestamp: new Date().toISOString(),
  };
  
  console.log('Environment info:', info);
  return info;
}

/**
 * Instructions for viewing logs on mobile
 */
export function getDebugInstructions() {
  const instructions = {
    ios: [
      '1. Connect iPhone to Mac via USB',
      '2. Open Safari on Mac',
      '3. Enable "Develop" menu: Safari > Preferences > Advanced > Show Develop menu',
      '4. Develop > [Your iPhone] > [Telegram WebView]',
      '5. Open Console to see logs',
    ],
    android: [
      '1. Enable USB Debugging on Android',
      '2. Connect Android to computer via USB',
      '3. Open Chrome on computer',
      '4. Go to chrome://inspect',
      '5. Find Telegram WebView and click "inspect"',
      '6. Open Console to see logs',
    ],
    alternative: [
      'Use showDebugInfo() and logError() functions',
      'They will show alerts in Telegram Mini App',
      'Check console.log output in browser DevTools',
    ],
  };
  
  return instructions;
}
