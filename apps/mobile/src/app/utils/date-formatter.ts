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
