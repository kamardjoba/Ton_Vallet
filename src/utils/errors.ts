/**
 * Error handling utilities
 * Provides user-friendly error messages
 */

export interface ErrorDetails {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
}

/**
 * Error codes and user-friendly messages
 */
const ERROR_MESSAGES: Record<string, Omit<ErrorDetails, 'code'>> = {
  // Network errors
  NETWORK_ERROR: {
    message: 'Network request failed',
    userMessage: 'Unable to connect to the network. Please check your internet connection and try again.',
    recoverable: true,
  },
  TIMEOUT: {
    message: 'Request timeout',
    userMessage: 'The request took too long. Please try again.',
    recoverable: true,
  },
  RATE_LIMIT: {
    message: 'Rate limit exceeded',
    userMessage: 'Too many requests. Please wait a moment and try again.',
    recoverable: true,
  },

  // Wallet errors
  WALLET_NOT_INITIALIZED: {
    message: 'Wallet is not initialized',
    userMessage: 'Please initialize your wallet first.',
    recoverable: false,
  },
  WALLET_LOCKED: {
    message: 'Wallet is locked',
    userMessage: 'Please unlock your wallet to continue.',
    recoverable: false,
  },
  INVALID_PASSWORD: {
    message: 'Invalid password',
    userMessage: 'The password you entered is incorrect. Please try again.',
    recoverable: true,
  },
  INVALID_SEED_PHRASE: {
    message: 'Invalid seed phrase',
    userMessage: 'The seed phrase you entered is invalid. Please check and try again.',
    recoverable: true,
  },

  // Transaction errors
  INSUFFICIENT_BALANCE: {
    message: 'Insufficient balance',
    userMessage: 'You don\'t have enough TON to complete this transaction. Please check your balance.',
    recoverable: false,
  },
  INVALID_ADDRESS: {
    message: 'Invalid address',
    userMessage: 'The recipient address is invalid. Please check and try again.',
    recoverable: true,
  },
  INVALID_AMOUNT: {
    message: 'Invalid amount',
    userMessage: 'The amount you entered is invalid. Please enter a valid amount.',
    recoverable: true,
  },
  TRANSACTION_FAILED: {
    message: 'Transaction failed',
    userMessage: 'The transaction could not be completed. Please try again later.',
    recoverable: true,
  },
  TRANSACTION_REJECTED: {
    message: 'Transaction rejected',
    userMessage: 'The transaction was rejected. Please check the details and try again.',
    recoverable: true,
  },

  // API errors
  API_ERROR: {
    message: 'API error',
    userMessage: 'An error occurred while communicating with the blockchain. Please try again later.',
    recoverable: true,
  },
  BLOCKCHAIN_ERROR: {
    message: 'Blockchain error',
    userMessage: 'An error occurred on the blockchain. Please try again later.',
    recoverable: true,
  },

  // Security errors
  SECURITY_ERROR: {
    message: 'Security error',
    userMessage: 'A security error occurred. Please refresh the page and try again.',
    recoverable: true,
  },
  ENCRYPTION_ERROR: {
    message: 'Encryption error',
    userMessage: 'An error occurred while encrypting your data. Please try again.',
    recoverable: true,
  },
  DECRYPTION_ERROR: {
    message: 'Decryption error',
    userMessage: 'Unable to decrypt your data. Please check your password and try again.',
    recoverable: true,
  },

  // Unknown error
  UNKNOWN_ERROR: {
    message: 'Unknown error',
    userMessage: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    recoverable: true,
  },
};

/**
 * Gets user-friendly error message
 */
export function getUserFriendlyError(error: Error | string | unknown): ErrorDetails {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorUpper = errorMessage.toUpperCase();

  // Try to match error codes
  for (const [code, details] of Object.entries(ERROR_MESSAGES)) {
    if (errorUpper.includes(code) || errorUpper.includes(details.message.toUpperCase())) {
      return {
        code,
        ...details,
      };
    }
  }

  // Check for specific patterns
  if (errorUpper.includes('RATE LIMIT') || errorUpper.includes('429')) {
    return {
      code: 'RATE_LIMIT',
      ...ERROR_MESSAGES.RATE_LIMIT,
    };
  }

  if (errorUpper.includes('NETWORK') || errorUpper.includes('FETCH')) {
    return {
      code: 'NETWORK_ERROR',
      ...ERROR_MESSAGES.NETWORK_ERROR,
    };
  }

  if (errorUpper.includes('TIMEOUT')) {
    return {
      code: 'TIMEOUT',
      ...ERROR_MESSAGES.TIMEOUT,
    };
  }

  if (errorUpper.includes('INSUFFICIENT') || errorUpper.includes('BALANCE')) {
    return {
      code: 'INSUFFICIENT_BALANCE',
      ...ERROR_MESSAGES.INSUFFICIENT_BALANCE,
    };
  }

  if (errorUpper.includes('INVALID PASSWORD') || errorUpper.includes('DECRYPT')) {
    return {
      code: 'INVALID_PASSWORD',
      ...ERROR_MESSAGES.INVALID_PASSWORD,
    };
  }

  // Default to unknown error
  return {
    code: 'UNKNOWN_ERROR',
    ...ERROR_MESSAGES.UNKNOWN_ERROR,
  };
}

/**
 * Formats error for display
 */
export function formatError(error: Error | string | unknown): string {
  return getUserFriendlyError(error).userMessage;
}

/**
 * Checks if error is recoverable
 */
export function isRecoverableError(error: Error | string | unknown): boolean {
  return getUserFriendlyError(error).recoverable;
}
