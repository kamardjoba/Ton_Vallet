/**
 * Validation utilities for user input
 * Provides validation functions for addresses, amounts, passwords, etc.
 */

/**
 * Validates TON address format
 */
export function validateTONAddress(address: string): { valid: boolean; error?: string } {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }

  const trimmed = address.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Address cannot be empty' };
  }

  // TON addresses can be:
  // - Raw format: 0:... or -1:...
  // - User-friendly format: EQ..., UQ..., etc.
  // - Base64 encoded
  const rawFormat = /^[0-9-]+:[a-fA-F0-9]+$/;
  const userFriendlyFormat = /^[A-Za-z0-9_-]+$/;
  
  if (!rawFormat.test(trimmed) && !userFriendlyFormat.test(trimmed)) {
    return { valid: false, error: 'Invalid address format' };
  }

  // Check length (TON addresses are typically 48 characters in user-friendly format)
  if (trimmed.length < 10 || trimmed.length > 100) {
    return { valid: false, error: 'Address length is invalid' };
  }

  return { valid: true };
}

/**
 * Validates TON amount
 */
export function validateTONAmount(amount: string): { valid: boolean; error?: string; value?: number } {
  if (!amount || typeof amount !== 'string') {
    return { valid: false, error: 'Amount is required' };
  }

  const trimmed = amount.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Amount cannot be empty' };
  }

  // Remove any whitespace and commas
  const cleaned = trimmed.replace(/[\s,]/g, '');
  
  // Check for valid number format
  const numberRegex = /^[0-9]+\.?[0-9]*$/;
  if (!numberRegex.test(cleaned)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  const numValue = parseFloat(cleaned);
  
  if (isNaN(numValue)) {
    return { valid: false, error: 'Amount must be a valid number' };
  }

  if (numValue <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }

  if (numValue > 1000000000) {
    return { valid: false, error: 'Amount is too large' };
  }

  // Check decimal places (TON has 9 decimal places)
  const decimalParts = cleaned.split('.');
  if (decimalParts.length > 1 && decimalParts[1].length > 9) {
    return { valid: false, error: 'Amount has too many decimal places (max 9)' };
  }

  return { valid: true, value: numValue };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string; strength?: 'weak' | 'medium' | 'strong' } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password is too long (max 128 characters)' };
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  // Check for at least one letter
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one letter' };
  }

  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  let score = 0;

  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score >= 3) strength = 'strong';
  else if (score >= 2) strength = 'medium';

  return { valid: true, strength };
}

/**
 * Validates seed phrase
 */
export function validateSeedPhrase(seedPhrase: string): { valid: boolean; error?: string } {
  if (!seedPhrase || typeof seedPhrase !== 'string') {
    return { valid: false, error: 'Seed phrase is required' };
  }

  const trimmed = seedPhrase.trim();
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);

  if (words.length !== 24) {
    return { valid: false, error: 'Seed phrase must contain exactly 24 words' };
  }

  // Check for empty words
  if (words.some(word => word.length === 0)) {
    return { valid: false, error: 'Seed phrase contains empty words' };
  }

  // Check word length (BIP39 words are typically 3-8 characters)
  if (words.some(word => word.length < 3 || word.length > 20)) {
    return { valid: false, error: 'Some words in seed phrase are invalid' };
  }

  return { valid: true };
}

/**
 * Sanitizes user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validates comment/note for transaction
 */
export function validateComment(comment: string): { valid: boolean; error?: string } {
  if (!comment || typeof comment !== 'string') {
    return { valid: true }; // Comment is optional
  }

  const trimmed = comment.trim();

  if (trimmed.length > 1000) {
    return { valid: false, error: 'Comment is too long (max 1000 characters)' };
  }

  // Check for potentially dangerous content
  const dangerousPatterns = [
    /<script/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Comment contains invalid characters' };
    }
  }

  return { valid: true };
}

/**
 * Validates URL (for IPFS, HTTP, etc.)
 */
export function validateURL(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = url.trim();

  try {
    // Allow IPFS protocol
    if (trimmed.startsWith('ipfs://')) {
      return { valid: true };
    }

    // Validate HTTP/HTTPS URLs
    const urlObj = new URL(trimmed);
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
