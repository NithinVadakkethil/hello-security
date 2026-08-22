export function normalizeRole(role?: string | null): string {
  if (!role) return 'SECURITY';
  const u = role.toUpperCase().trim();
  if (u === 'SECURITY' || u === 'SECURITY GUARD' || u === 'SECURITY_GUARD') return 'SECURITY';
  if (u === 'CLEANER' || u === 'HOUSE KEEPING' || u === 'HOUSE_KEEPING' || u === 'HOUSEKEEPING') return 'CLEANER';
  if (u === 'SERVICE ENGINEER' || u === 'SERVICE_ENGINEER') return 'SERVICE_ENGINEER';
  if (u === 'LIFE GUARD' || u === 'LIFE_GUARD' || u === 'LIFEGUARD') return 'LIFE_GUARD';
  return u.replace(/[\s-]+/g, '_');
}

export function isRoleMatching(subTaskRole?: string | null, targetRole?: string | null): boolean {
  if (!subTaskRole || !targetRole) return false;
  return normalizeRole(subTaskRole) === normalizeRole(targetRole);
}
