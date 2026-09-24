export const ROLE_PRIORITY_MAP: Record<string, number> = {
  SECURITY: 1,
  SECURITY_GUARD: 1,

  CLEANER: 2,
  HOUSE_KEEPING: 2,
  HOUSEKEEPING: 2,

  TECHNICIAN: 3,

  SUPERVISOR: 4,

  MANAGER: 5,
  COMMUNITY_MANAGER: 5,

  SERVICE_ENGINEER: 6,

  LIFE_GUARD: 7,
  LIFEGUARD: 7,

  PLUMBER: 8,
};

export function getRolePriority(role?: string | null): number {
  if (!role) return 99;
  const normalized = role.toUpperCase().trim();
  return ROLE_PRIORITY_MAP[normalized] ?? 99;
}

export function compareEmployeesByRoleOrder(a: any, b: any): number {
  const pA = getRolePriority(a.role);
  const pB = getRolePriority(b.role);

  if (pA !== pB) {
    return pA - pB;
  }

  // Secondary sort: employee name ascending
  const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
  const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();

  return nameA.localeCompare(nameB);
}
