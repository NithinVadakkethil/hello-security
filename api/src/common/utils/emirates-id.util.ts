/**
 * Emirates ID (UAE National Identity) Utilities
 *
 * Presentation format: 784-XXXX-XXXXXXX-X (15 digits total)
 * Masked format:       784-****-*******-X
 */

/**
 * Strips all non-digit characters from an input string.
 */
export function extractEmiratesIdDigits(input?: string | null): string {
  if (!input) return '';
  return input.replace(/\D/g, '');
}

/**
 * Normalizes input digits into standard format: 784-XXXX-XXXXXXX-X
 * Accepts formatted or unformatted strings.
 */
export function normalizeEmiratesId(input?: string | null): string {
  if (!input) return '';
  const digits = extractEmiratesIdDigits(input);

  if (digits.length !== 15) {
    return input.trim();
  }

  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 7);
  const p3 = digits.slice(7, 14);
  const p4 = digits.slice(14, 15);

  return `${p1}-${p2}-${p3}-${p4}`;
}

export interface EmiratesIdValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validates the Emirates ID against the 15-digit structure and UAE prefix (784).
 * Does NOT infer DOB or other personal attributes.
 */
export function validateEmiratesId(input?: string | null, isRequired = false): EmiratesIdValidationResult {
  if (!input || input.trim() === '') {
    if (isRequired) {
      return { valid: false, error: 'Emirates ID is required.' };
    }
    return { valid: true, normalized: '' };
  }

  const digits = extractEmiratesIdDigits(input);

  if (digits.length !== 15) {
    return {
      valid: false,
      error: `Emirates ID must contain exactly 15 digits (currently ${digits.length}). Expected format: 784-XXXX-XXXXXXX-X.`,
    };
  }

  if (!digits.startsWith('784')) {
    return {
      valid: false,
      error: 'Emirates ID must start with UAE prefix 784. Expected format: 784-XXXX-XXXXXXX-X.',
    };
  }

  const normalized = normalizeEmiratesId(digits);
  return { valid: true, normalized };
}

/**
 * Masks Emirates ID for privacy-compliant displays.
 * Example output: 784-****-*******-5
 * If null/empty, returns 'Not provided'.
 */
export function maskEmiratesId(input?: string | null): string {
  if (!input || input.trim() === '') {
    return 'Not provided';
  }

  const digits = extractEmiratesIdDigits(input);
  if (digits.length !== 15 || !digits.startsWith('784')) {
    // If legacy or non-standard format, return generic placeholder or Not provided
    return 'Not provided';
  }

  const lastDigit = digits.slice(-1);
  return `784-****-*******-${lastDigit}`;
}

