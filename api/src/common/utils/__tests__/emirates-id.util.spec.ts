import {
  extractEmiratesIdDigits,
  normalizeEmiratesId,
  validateEmiratesId,
  maskEmiratesId,
  formatEmiratesId,
} from '../emirates-id.util';

describe('Emirates ID Utilities', () => {
  describe('extractEmiratesIdDigits', () => {
    it('should strip all hyphens, spaces, and non-digit characters', () => {
      expect(extractEmiratesIdDigits('784-1990-1234567-1')).toBe('784199012345671');
      expect(extractEmiratesIdDigits('784 1990 1234567 1')).toBe('784199012345671');
      expect(extractEmiratesIdDigits(null)).toBe('');
      expect(extractEmiratesIdDigits(undefined)).toBe('');
    });
  });

  describe('normalizeEmiratesId', () => {
    it('should format 15 digits into standard 784-XXXX-XXXXXXX-X format', () => {
      expect(normalizeEmiratesId('784199012345671')).toBe('784-1990-1234567-1');
      expect(normalizeEmiratesId('784-1990-1234567-1')).toBe('784-1990-1234567-1');
    });

    it('should return trimmed input if not 15 digits', () => {
      expect(normalizeEmiratesId('12345')).toBe('12345');
      expect(normalizeEmiratesId('')).toBe('');
    });
  });

  describe('validateEmiratesId', () => {
    it('should validate standard 15-digit Emirates ID starting with 784', () => {
      const result = validateEmiratesId('784-1990-1234567-1');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('784-1990-1234567-1');
      expect(result.error).toBeUndefined();
    });

    it('should validate unhyphenated 15-digit input starting with 784', () => {
      const result = validateEmiratesId('784199012345671');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('784-1990-1234567-1');
    });

    it('should reject inputs with fewer or more than 15 digits', () => {
      const tooShort = validateEmiratesId('784-1990-123456-1');
      expect(tooShort.valid).toBe(false);
      expect(tooShort.error).toContain('must contain exactly 15 digits');

      const tooLong = validateEmiratesId('784-1990-12345678-1');
      expect(tooLong.valid).toBe(false);
      expect(tooLong.error).toContain('must contain exactly 15 digits');
    });

    it('should reject inputs not starting with UAE prefix 784', () => {
      const wrongPrefix = validateEmiratesId('123-1990-1234567-1');
      expect(wrongPrefix.valid).toBe(false);
      expect(wrongPrefix.error).toContain('must start with UAE prefix 784');
    });

    it('should handle optional empty input when not required', () => {
      const empty = validateEmiratesId('', false);
      expect(empty.valid).toBe(true);
      expect(empty.normalized).toBe('');
    });

    it('should reject empty input when required', () => {
      const required = validateEmiratesId('', true);
      expect(required.valid).toBe(false);
      expect(required.error).toContain('required');
    });
  });

  describe('maskEmiratesId', () => {
    it('should mask standard Emirates ID in 784-****-*******-X format', () => {
      expect(maskEmiratesId('784-1990-1234567-1')).toBe('784-****-*******-1');
      expect(maskEmiratesId('784199012345675')).toBe('784-****-*******-5');
    });

    it('should return "Not provided" for null, undefined, or empty values', () => {
      expect(maskEmiratesId(null)).toBe('Not provided');
      expect(maskEmiratesId(undefined)).toBe('Not provided');
      expect(maskEmiratesId('')).toBe('Not provided');
    });

    it('should return "Not provided" for invalid / legacy non-standard formats', () => {
      expect(maskEmiratesId('invalid-id')).toBe('Not provided');
    });
  });

  describe('formatEmiratesId', () => {
    it('should format raw or formatted 15-digit Emirates ID as 784-XXXX-XXXXXXX-X unmasked', () => {
      expect(formatEmiratesId('784199012345671')).toBe('784-1990-1234567-1');
      expect(formatEmiratesId('784-1990-1234567-1')).toBe('784-1990-1234567-1');
    });

    it('should return "Not provided" for null, undefined, or empty values', () => {
      expect(formatEmiratesId(null)).toBe('Not provided');
      expect(formatEmiratesId(undefined)).toBe('Not provided');
      expect(formatEmiratesId('')).toBe('Not provided');
      expect(formatEmiratesId('   ')).toBe('Not provided');
    });
  });
});

