/**
 * Safely calculates completion / compliance percentage with safe denominator guard.
 *
 * Business Rules:
 * - 0 / 0 => 0%
 * - 0 / 1 => 0%
 * - 1 / 1 => 100%
 * - 3 / 5 => 60%
 * - 8 / 10 => 80%
 *
 * Prevents NaN, Infinity, and division by zero.
 */
export function calculateCompliancePercentage(completed: number, total: number): number {
  if (!total || total <= 0 || !completed || completed <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((completed / total) * 100));
}

