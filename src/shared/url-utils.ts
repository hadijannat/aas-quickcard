/**
 * URL validation and safe navigation utilities
 * Prevents XSS and ensures secure window.open() calls
 */

// Allowed URL schemes for navigation
const ALLOWED_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:'];

/**
 * Check if a URL has an allowed scheme
 * Blocks javascript:, data:, and other potentially dangerous schemes
 */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    return ALLOWED_SCHEMES.includes(parsed.protocol);
  } catch {
    // Invalid URL
    return false;
  }
}

/**
 * Open a URL safely with noopener,noreferrer
 * Returns false if URL is blocked
 */
export function safeWindowOpen(url: string): boolean {
  if (!isAllowedUrl(url)) {
    console.warn('Blocked unsafe URL:', url);
    return false;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

// Track active blob URLs for cleanup
const activeBlobUrls = new Map<string, number>();

/**
 * Create a blob URL with automatic revocation after timeout
 * Prevents memory leaks and lingering access to blob content
 */
export function createTrackedBlobUrl(blob: Blob, timeoutMs = 60000): string {
  const url = URL.createObjectURL(blob);

  // Schedule revocation
  const timerId = window.setTimeout(() => {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }, timeoutMs);

  activeBlobUrls.set(url, timerId);
  return url;
}

/**
 * Manually revoke a tracked blob URL
 */
export function revokeTrackedBlobUrl(url: string): void {
  const timerId = activeBlobUrls.get(url);
  if (timerId !== undefined) {
    clearTimeout(timerId);
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }
}

/**
 * Sanitize a phone number - remove characters that could be URL-encoded attacks
 * Allows only digits, +, -, (, ), and spaces
 */
export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d+\-() ]/g, '');
}

/**
 * Validate email address has basic structure
 */
export function isValidEmail(email: string): boolean {
  return email.includes('@') && email.indexOf('@') > 0 && email.indexOf('@') < email.length - 1;
}
