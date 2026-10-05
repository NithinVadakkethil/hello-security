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

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
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
 * Given a shift start time (e.g. "22:00"), shift end time (e.g. "06:00"),
 * shift date (e.g. 2026-09-30), target patrol time (e.g. "03:00"), and window offsets,
 * returns the exact UTC Date objects for scheduledAt, windowStart, and windowEnd
 * according to the shift/business timezone.
 */
export function calculateMandatoryWindow(
  shiftStartTimeStr: string,
  shiftEndTimeStr: string,
  shiftDate: Date | string,
  targetTimeStr: string,
  windowBeforeMins: number = 15,
  windowAfterMins: number = 15,
  timeZone: string = DEFAULT_TIMEZONE,
): MandatoryWindowResult {
  const shiftStartMins = parseTimeToMinutes(shiftStartTimeStr);
  const shiftEndMins = parseTimeToMinutes(shiftEndTimeStr);
  const targetMins = parseTimeToMinutes(targetTimeStr);

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
