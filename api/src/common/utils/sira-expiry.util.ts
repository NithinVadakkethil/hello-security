/**
 * Centralized utility to check if a role requires SIRA compliance.
 *
 * Rules:
 * - SECURITY: true
 * - SUPERVISOR: true
 * - All other roles: false
 */
export function isSiraRequiredForRole(role?: string | null): boolean {
  if (!role) return false;
  const upper = role.toUpperCase();
  return upper === 'SECURITY' || upper === 'SUPERVISOR';
}

/**
 * Centralized utility to check if an employee's SIRA card has expired.
 *
 * Rules:
 * 1. Applies to employees with role 'SECURITY' or 'SUPERVISOR'.
 * 2. If no SIRA expiry date is set, returns false (not expired / backward compatible).
 * 3. The card remains valid throughout the entire day of the expiry date.
 * 4. Restriction starts on 00:00:00 of the day FOLLOWING the expiry date.
 */
export function isSiraExpired(
  employee?: {
    role?: string | null;
    siraCardExpiryDate?: Date | string | null;
  } | null,
  referenceDate: Date = new Date(),
): boolean {
  if (!employee || !isSiraRequiredForRole(employee.role)) {
    return false;
  }

  if (!employee.siraCardExpiryDate) {
    return false;
  }

  const expiryDate = new Date(employee.siraCardExpiryDate);
  if (isNaN(expiryDate.getTime())) {
    return false;
  }

  // End of expiry day in local/UTC time (23:59:59.999)
  const endOfExpiryDay = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate(),
    23,
    59,
    59,
    999,
  );

  return referenceDate > endOfExpiryDay;
}

// Backward-compatible alias
export const isSecuritySiraExpired = isSiraExpired;

