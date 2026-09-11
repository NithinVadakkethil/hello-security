const DEFAULT_TIMEZONE = 'Asia/Dubai';

/**
 * Formats a date to "D MMM YYYY" (e.g. "4 Sep 2026")
 */
export function formatPatrolDate(
  dateInput: string | Date | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Formats a time to "h:mm:ss A" (e.g. "8:32:53 AM") or "h:mm A"
 */
export function formatPatrolTime(
  dateInput: string | Date | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  includeSeconds = true,
): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
      timeZone,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Formats a full date-time to "D MMM YYYY, h:mm:ss A" (e.g. "4 Sep 2026, 8:32:53 AM")
 */
export function formatPatrolDateTime(
  dateInput: string | Date | number | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE,
  includeSeconds = true,
): string {
  if (!dateInput) return '—';
  const dateStr = formatPatrolDate(dateInput, timeZone);
  const timeStr = formatPatrolTime(dateInput, timeZone, includeSeconds);
  if (dateStr === '—' || timeStr === '—') return '—';
  return `${dateStr}, ${timeStr}`;
}

/**
 * Formats a lastCompletedAt timestamp for Home screen patrol cards according to local calendar date rules.
 * Rules:
 * - Same local calendar date: "Today, 3:46:46 PM"
 * - Previous local calendar date: "Yesterday, 3:46:46 PM"
 * - Older date, same year: "Sep 9, 3:46:46 PM"
 * - Older date, different year: "Sep 9, 2025, 3:46:46 PM"
 */
export function formatLastCompletedAt(
  timestamp: string | Date | number | null | undefined,
  nowOverride?: string | Date | number,
): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;

  const now = nowOverride ? new Date(nowOverride) : new Date();

  // Local calendar date comparison (midnight normalized)
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = todayDate.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

  // Time formatting: 12-hour format with AM/PM (h:mm:ss A)
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const timeStr = `${hours12}:${minutes}:${seconds} ${ampm}`;

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthName = monthNames[date.getMonth()];
  const dayNum = date.getDate();
  const year = date.getFullYear();
  const currentYear = now.getFullYear();

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${timeStr}`;
  } else if (year === currentYear) {
    return `${monthName} ${dayNum}, ${timeStr}`;
  } else {
    return `${monthName} ${dayNum}, ${year}, ${timeStr}`;
  }
}
