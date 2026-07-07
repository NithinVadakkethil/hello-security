export function generateCode(prefix: string, sequence: number): string {
  return `${prefix}-${sequence.toString().padStart(6, '0')}`;
}
