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
 * Given a shift start and end time, determines the effective shift base date (accounting for overnight shifts).
 */
export function getEffectiveShiftDate(
  shiftStartTimeStr?: string | null,
  shiftEndTimeStr?: string | null,
  refDate: Date = new Date(),
): Date {
  const dateOnly = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  if (!shiftStartTimeStr || !shiftEndTimeStr) return dateOnly;

  const startMins = parseTimeToMinutes(shiftStartTimeStr);
  const endMins = parseTimeToMinutes(shiftEndTimeStr);
  const nowMins = refDate.getHours() * 60 + refDate.getMinutes();

  const isOvernight = endMins <= startMins;
  // If overnight and current time is past midnight but before or right around shift end
  if (isOvernight && nowMins < endMins + 60) {
    const yesterday = new Date(dateOnly);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  return dateOnly;
}

/**
 * Given a shift start time (e.g. "22:00"), shift end time (e.g. "06:00"),
 * shift date (e.g. 2026-09-30), target patrol time (e.g. "03:00"), and window offsets,
 * returns the exact Date objects for scheduledAt, windowStart, and windowEnd.
 */
export function calculateMandatoryWindow(
  shiftStartTimeStr: string,
  shiftEndTimeStr: string,
  shiftDate: Date,
  targetTimeStr: string,
  windowBeforeMins: number = 15,
  windowAfterMins: number = 15,
): MandatoryWindowResult {
  const shiftStartMins = parseTimeToMinutes(shiftStartTimeStr);
  const shiftEndMins = parseTimeToMinutes(shiftEndTimeStr);
  const targetMins = parseTimeToMinutes(targetTimeStr);

  const isOvernight = shiftEndMins <= shiftStartMins;

  // Base date components in local/server time
  const baseYear = shiftDate.getFullYear();
  const baseMonth = shiftDate.getMonth();
  const baseDay = shiftDate.getDate();

  const targetHours = Math.floor(targetMins / 60);
  const targetMinutes = targetMins % 60;

  let scheduledDate = new Date(baseYear, baseMonth, baseDay, targetHours, targetMinutes, 0, 0);

  // If overnight shift and target time is in the morning portion (after midnight),
  // add 1 day to scheduledDate
  if (isOvernight && targetMins < shiftStartMins) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  const windowStart = new Date(scheduledDate.getTime() - windowBeforeMins * 60 * 1000);
  const windowEnd = new Date(scheduledDate.getTime() + windowAfterMins * 60 * 1000);

  return {
    scheduledAt: scheduledDate,
    windowStart,
    windowEnd,
  };
}
