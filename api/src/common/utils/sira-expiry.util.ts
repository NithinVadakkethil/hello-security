/**
 * Centralized utility to check if a Security employee's SIRA card has expired.
 *
 * Rules:
 * 1. Applies ONLY to employees with role 'SECURITY'.
 * 2. If no SIRA expiry date is set, returns false (not expired / backward compatible).
 * 3. The card remains valid throughout the entire day of the expiry date.
 * 4. Restriction starts on 00:00:00 of the day FOLLOWING the expiry date.
 */
export function isSecuritySiraExpired(
  employee?: {
    role?: string | null;
    siraCardExpiryDate?: Date | string | null;
  } | null,
  referenceDate: Date = new Date(),
): boolean {
  if (!employee || employee.role !== 'SECURITY') {
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
