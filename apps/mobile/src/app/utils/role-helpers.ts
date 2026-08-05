import { Shield, Sparkles, Wrench, Cpu, Droplet, LifeBuoy, LucideIcon } from 'lucide-react-native';

export const OPERATIONAL_ROLES = [
  'SECURITY',
  'SECURITY_GUARD',
  'CLEANER',
  'TECHNICIAN',
  'SERVICE_ENGINEER',
  'PLUMBER',
  'LIFE_GUARD',
  'LIFEGUARD',
] as const;

export type OperationalRoleType = (typeof OPERATIONAL_ROLES)[number];

export function isOperationalRole(role?: string): boolean {
  if (!role) return false;
  const normalized = role.toUpperCase();
  return OPERATIONAL_ROLES.includes(normalized as any);
}

export interface RoleConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

export function getRoleConfig(role?: string): RoleConfig {
  const normalized = (role || 'SECURITY').toUpperCase();

  switch (normalized) {
    case 'CLEANER':
      return { label: 'Cleaner', icon: Sparkles, color: '#10b981' };
    case 'TECHNICIAN':
      return { label: 'Technician', icon: Wrench, color: '#f59e0b' };
    case 'SERVICE_ENGINEER':
      return { label: 'Service Engineer', icon: Cpu, color: '#8b5cf6' };
    case 'PLUMBER':
      return { label: 'Plumber', icon: Droplet, color: '#06b6d4' };
    case 'LIFE_GUARD':
    case 'LIFEGUARD':
      return { label: 'Lifeguard', icon: LifeBuoy, color: '#ec4899' };
    case 'SECURITY':
    case 'SECURITY_GUARD':
    default:
      return { label: 'Security Guard', icon: Shield, color: '#3b82f6' };
  }
}

export function formatRoleGreeting(role?: string, name?: string): string {
  const config = getRoleConfig(role);
  const displayName = name ? name.trim() : 'User';
  return `${config.label} ${displayName}`;
}
