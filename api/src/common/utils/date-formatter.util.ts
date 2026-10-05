export const DEFAULT_TIMEZONE =
  process.env.DEFAULT_TIMEZONE || process.env.TIMEZONE || 'Asia/Dubai';

/**
 * Returns the date components (year, month 1-12, day, hours, minutes, seconds)
 * of a given Date in the target IANA timezone.
 */
export function getDateComponentsInTimezone(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = parseInt(p.value, 10);
    }
  }
  if (partMap.hour === 24) partMap.hour = 0;
  return {
    year: partMap.year,
    month: partMap.month,
    day: partMap.day,
    hours: partMap.hour,
    minutes: partMap.minute,
    seconds: partMap.second || 0,
  };
}

/**
 * Constructs a Date (UTC timestamp) representing the exact wall-clock date and time
 * in the specified IANA timezone.
 */
export function createDateInTimezone(
  year: number,
  month: number, // 1-12
  day: number,
  hours: number,
  minutes: number,
  seconds: number = 0,
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  // Candidate treated as UTC
  const utcCandidate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  // Determine wall-clock time in the target timezone when UTC is utcCandidate
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcCandidate);
  const partMap: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      partMap[p.type] = parseInt(p.value, 10);
    }
  }
  if (partMap.hour === 24) partMap.hour = 0;

  const tzTimeAsUtc = Date.UTC(
    partMap.year,
    partMap.month - 1,
    partMap.day,
    partMap.hour,
    partMap.minute,
    partMap.second || 0,
  );

  const offsetMs = tzTimeAsUtc - utcCandidate.getTime();
  return new Date(utcCandidate.getTime() - offsetMs);
}

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
