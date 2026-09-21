export function getEmployeeDisplayName(user: any): string {
  if (!user) return 'User';

  // 1. Check nested employee object full name or firstName + lastName
  const emp = user.employee;
  if (emp) {
    if (typeof emp.name === 'string' && emp.name.trim()) {
      return emp.name.trim();
    }
    if (typeof emp.fullName === 'string' && emp.fullName.trim()) {
      return emp.fullName.trim();
    }
    const empFirstLast = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    if (empFirstLast) {
      return empFirstLast;
    }
  }

  // 2. Check top-level user.firstName + user.lastName
  const userFirstLast = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (userFirstLast) {
    return userFirstLast;
  }

  // 3. Check top-level user.name / user.displayName
  if (typeof user.name === 'string' && user.name.trim()) {
    return user.name.trim();
  }
  if (typeof user.displayName === 'string' && user.displayName.trim()) {
    return user.displayName.trim();
  }

  // 4. Fallback to email username as LAST RESORT
  if (typeof user.email === 'string' && user.email.includes('@')) {
    const emailPrefix = user.email.split('@')[0].trim();
    if (emailPrefix) {
      return emailPrefix;
    }
  }

  return 'User';
}
