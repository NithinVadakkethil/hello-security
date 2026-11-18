import {
  DEFAULT_TIMEZONE,
  createDateInTimezone,
  getDateComponentsInTimezone,
} from '../../common/utils/date-formatter.util';

/**
 * Utility for Mandatory Patrol Window & Overnight Shift Date Calculations
 */

export interface MandatoryWindowResult {
  scheduledAt: Date;
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Normalizes user/admin time input to strict 24-hour "HH:mm" format.
 * Supports:
 * - Bare hour: "11" -> "11:00", "18" -> "18:00", "0" -> "00:00", "9" -> "09:00", "23" -> "23:00"
 * - Standard 24h: "08:00" -> "08:00", "8:00" -> "08:00", "18:30" -> "18:30", "23:59" -> "23:59"
 * - 12h AM/PM: "11:00 AM" -> "11:00", "6:00 PM" -> "18:00", "11 AM" -> "11:00", "6 PM" -> "18:00", "12:00 AM" -> "00:00", "12:00 PM" -> "12:00"
 * Returns null if input is empty, null, undefined, or invalid (e.g. "24", "25:00", "11:65", "abc").
 */
export function normalizeTimeInput(timeStr?: string | null): string | null {
  if (timeStr === undefined || timeStr === null) return null;
  const trimmed = timeStr.trim();
  if (trimmed === '') return null;

  // 1. Bare hour (e.g. "11", "18", "0", "9", "23")
  const bareHourMatch = trimmed.match(/^(\d{1,2})$/);
  if (bareHourMatch) {
    const hour = parseInt(bareHourMatch[1], 10);
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, '0')}:00`;
    }
    return null;
  }

  // 2. 12-hour AM/PM format (e.g. "11:00 AM", "6:00 PM", "11 AM", "6 PM", "12:30 am")
  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] !== undefined ? parseInt(ampmMatch[2], 10) : 0;
    const period = ampmMatch[3].toUpperCase();

    if (hour < 1 || hour > 12) return null;
    if (minute < 0 || minute > 59) return null;

    if (period === 'AM') {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // 3. Standard 24-hour HH:mm format (e.g. "08:00", "18:30", "8:00", "23:59")
  const standardMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (standardMatch) {
    const hour = parseInt(standardMatch[1], 10);
    const minute = parseInt(standardMatch[2], 10);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    return null;
  }

  return null;
}

/**
 * Checks if a string represents a valid time input.
 */
export function isValidTimeFormat(timeStr?: string | null): boolean {
  return normalizeTimeInput(timeStr) !== null;
}

/**
 * Parses a time string into minutes from midnight (0..1439).
 * Returns null if the time string is invalid or empty.
 * Explicit midnight ("00:00", "0", "12:00 AM") returns 0.
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  const normalized = normalizeTimeInput(timeStr);
  if (!normalized) return null;
  const parts = normalized.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

/**
 * Given a shift start and end time, determines the effective shift base date (accounting for overnight shifts)
 * in the configured business/shift timezone.
 */
export function getEffectiveShiftDate(
  shiftStartTimeStr?: string | null,
  shiftEndTimeStr?: string | null,
  refDate: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
): Date {
  const tzComponents = getDateComponentsInTimezone(refDate, timeZone);
  const dateOnly = new Date(Date.UTC(tzComponents.year, tzComponents.month - 1, tzComponents.day, 0, 0, 0, 0));
  if (!shiftStartTimeStr || !shiftEndTimeStr) return dateOnly;

  const startMins = parseTimeToMinutes(shiftStartTimeStr);
  const endMins = parseTimeToMinutes(shiftEndTimeStr);
  if (startMins === null || endMins === null) return dateOnly;

  const nowMins = tzComponents.hours * 60 + tzComponents.minutes;

  const isOvernight = endMins <= startMins;
  // If overnight and current time is past midnight but before or right around shift end
  if (isOvernight && nowMins < endMins + 60) {
    const yesterday = new Date(dateOnly);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday;
  }

  return dateOnly;
}

/**
 * Given a shift start time (e.g. "08:00"), shift end time (e.g. "20:00"),
 * shift date (e.g. 2026-11-16), target patrol time (e.g. "11", "18", "11:00"), and window offsets,
 * returns the exact UTC Date objects for scheduledAt, windowStart, and windowEnd
 * according to the shift/business timezone.
 * Returns null if targetTimeStr is missing or invalid.
 */
export function calculateMandatoryWindow(
  shiftStartTimeStr?: string | null,
  shiftEndTimeStr?: string | null,
  shiftDate: Date | string = new Date(),
  targetTimeStr?: string | null,
  windowBeforeMins: number = 15,
  windowAfterMins: number = 15,
  timeZone: string = DEFAULT_TIMEZONE,
): MandatoryWindowResult | null {
  const targetMins = parseTimeToMinutes(targetTimeStr);
  if (targetMins === null) {
    return null;
  }

  const shiftStartMins = parseTimeToMinutes(shiftStartTimeStr) ?? 0;
  const shiftEndMins = parseTimeToMinutes(shiftEndTimeStr) ?? 0;
  const isOvernight = shiftEndMins <= shiftStartMins;

  // Extract year, month, day
  let baseYear: number;
  let baseMonth: number;
  let baseDay: number;

  if (typeof shiftDate === 'string') {
    const [y, m, d] = shiftDate.split('T')[0].split('-').map((v) => parseInt(v, 10));
    baseYear = y;
    baseMonth = m;
    baseDay = d;
  } else if (shiftDate instanceof Date) {
    baseYear = shiftDate.getUTCFullYear();
    baseMonth = shiftDate.getUTCMonth() + 1;
    baseDay = shiftDate.getUTCDate();
  } else {
    const nowTz = getDateComponentsInTimezone(new Date(), timeZone);
    baseYear = nowTz.year;
    baseMonth = nowTz.month;
    baseDay = nowTz.day;
  }

  const targetHours = Math.floor(targetMins / 60);
  const targetMinutes = targetMins % 60;

  // If overnight shift and target time is in the morning portion (after midnight),
  // advance calendar day by 1
  let targetYear = baseYear;
  let targetMonth = baseMonth;
  let targetDay = baseDay;

  if (isOvernight && targetMins < shiftStartMins) {
    const nextDayDate = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay + 1));
    targetYear = nextDayDate.getUTCFullYear();
    targetMonth = nextDayDate.getUTCMonth() + 1;
    targetDay = nextDayDate.getUTCDate();
  }

  const scheduledDate = createDateInTimezone(
    targetYear,
    targetMonth,
    targetDay,
    targetHours,
    targetMinutes,
    0,
    timeZone,
  );

  const windowStart = new Date(scheduledDate.getTime() - windowBeforeMins * 60 * 1000);
  const windowEnd = new Date(scheduledDate.getTime() + windowAfterMins * 60 * 1000);

  return {
    scheduledAt: scheduledDate,
    windowStart,
    windowEnd,
  };
}
