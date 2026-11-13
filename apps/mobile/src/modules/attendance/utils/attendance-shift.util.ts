/**
 * Shift Occurrence and Business Date Utilities for Mobile Attendance
 * Handles day shifts, overnight shifts, midnight crossings, and local/server synchronization.
 */

export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toUpperCase();

  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const meridiem = match12[3];
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    return hours * 60 + mins;
  }

  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    return hours * 60 + mins;
  }

  return 0;
}

export function isShiftOvernight(startTimeStr?: string | null, endTimeStr?: string | null): boolean {
  if (!startTimeStr || !endTimeStr) return false;
  const startMins = parseTimeToMinutes(startTimeStr);
  const endMins = parseTimeToMinutes(endTimeStr);
  return endMins <= startMins;
}

/**
 * Resolves the logical shift business date (YYYY-MM-DD).
 * For overnight shifts (e.g. 22:00 to 09:00):
 * If current time is after midnight (e.g. 02:00 AM or 08:30 AM),
 * the shift belongs to yesterday's scheduled calendar date.
 */
export function resolveEffectiveAttendanceDate(
  shiftStartTime?: string | null,
  shiftEndTime?: string | null,
  refDate: Date = new Date(),
): string {
  const year = refDate.getFullYear();
  const month = String(refDate.getMonth() + 1).padStart(2, '0');
  const day = String(refDate.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (!shiftStartTime || !shiftEndTime) {
    return todayStr;
  }

  const overnight = isShiftOvernight(shiftStartTime, shiftEndTime);
  if (!overnight) {
    return todayStr;
  }

  const currentMins = refDate.getHours() * 60 + refDate.getMinutes();
  const endMins = parseTimeToMinutes(shiftEndTime);

  // If after midnight and within shift end + 4 hours buffer (e.g. up to 13:00 for a 09:00 shift end)
  if (currentMins <= endMins + 240) {
    // Current time is post-midnight part of yesterday's shift
    const yesterday = new Date(refDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yYear = yesterday.getFullYear();
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDay = String(yesterday.getDate()).padStart(2, '0');
    return `${yYear}-${yMonth}-${yDay}`;
  }

  return todayStr;
}

