import {
  extractEmiratesIdDigits,
  normalizeEmiratesId,
  formatEmiratesIdInput,
  validateEmiratesId,
  maskEmiratesId,
  formatEmiratesId,
} from '../src/lib/emirates-id';

describe('Frontend Emirates ID Utility', () => {
  it('should extract digits correctly', () => {
    expect(extractEmiratesIdDigits('784-1990-1234567-1')).toBe('784199012345671');
    expect(extractEmiratesIdDigits(null)).toBe('');
  });

  it('should format user input dynamically as typed', () => {
    expect(formatEmiratesIdInput('784')).toBe('784');
    expect(formatEmiratesIdInput('7841')).toBe('784-1');
    expect(formatEmiratesIdInput('7841990')).toBe('784-1990');
    expect(formatEmiratesIdInput('78419901')).toBe('784-1990-1');
    expect(formatEmiratesIdInput('78419901234567')).toBe('784-1990-1234567');
    expect(formatEmiratesIdInput('784199012345671')).toBe('784-1990-1234567-1');
  });

  it('should validate valid Emirates ID', () => {
    const result = validateEmiratesId('784-1990-1234567-1');
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe('784-1990-1234567-1');
  });

  it('should reject invalid length and invalid prefix', () => {
    expect(validateEmiratesId('784-1234').valid).toBe(false);
    expect(validateEmiratesId('123-1990-1234567-1').valid).toBe(false);
  });

  it('should mask Emirates ID with 784-****-*******-X', () => {
    expect(maskEmiratesId('784-1990-1234567-5')).toBe('784-****-*******-5');
    expect(maskEmiratesId('784199012345675')).toBe('784-****-*******-5');
    expect(maskEmiratesId(null)).toBe('Not provided');
    expect(maskEmiratesId('')).toBe('Not provided');
    expect(maskEmiratesId('invalid-string')).toBe('Not provided');
  });

  it('should format Emirates ID unmasked as 784-XXXX-XXXXXXX-X', () => {
    expect(formatEmiratesId('784-1990-1234567-5')).toBe('784-1990-1234567-5');
    expect(formatEmiratesId('784199012345675')).toBe('784-1990-1234567-5');
    expect(formatEmiratesId(null)).toBe('Not provided');
    expect(formatEmiratesId('')).toBe('Not provided');
    expect(formatEmiratesId('   ')).toBe('Not provided');
  });
});

