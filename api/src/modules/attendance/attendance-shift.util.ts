import {
  DEFAULT_TIMEZONE,
  createDateInTimezone,
  getDateComponentsInTimezone,
} from '../../common/utils/date-formatter.util';

export interface ShiftOccurrence {
  shiftDateStr: string;   // YYYY-MM-DD (logical start date of the shift occurrence)
  shiftDate: Date;        // UTC Date representation of shiftDateStr at 00:00:00.000Z
  scheduledStart: Date;   // Precise UTC timestamp of scheduled shift start
  scheduledEnd: Date;     // Precise UTC timestamp of scheduled shift end
  windowStart: Date;      // Earliest allowed check-in (e.g. 2 hours before scheduledStart)
  windowEnd: Date;        // Latest allowed check-out (e.g. 4 hours after scheduledEnd)
  isOvernight: boolean;   // True if shift crosses midnight into next calendar day
  isWithinWindow: boolean;
}

export interface ShiftContext {
  shiftDateStr: string;
  shiftDate: Date;
  shift: any | null;
  assignment: any | null;
  occurrence: ShiftOccurrence | null;
  isOvernight: boolean;
}

/**
 * Parses a time string (e.g. "22:00", "09:00", "10:00 PM", "9:00 AM")
 * into total minutes from midnight (0 - 1439).
 */
export function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const trimmed = timeStr.trim().toLowerCase();
  const isPM = trimmed.includes('pm');
  const isAM = trimmed.includes('am');

  const clean = trimmed.replace(/[^\d:]/g, '');
  const parts = clean.split(':');
  if (parts.length < 2) return 0;

  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return (hours % 24) * 60 + (minutes % 60);
}

/**
 * Returns true if shift crosses midnight into next calendar day (endTime <= startTime).
 */
export function isShiftOvernight(startTimeStr?: string | null, endTimeStr?: string | null): boolean {
  if (!startTimeStr || !endTimeStr) return false;
  const startMins = parseTimeToMinutes(startTimeStr);
  const endMins = parseTimeToMinutes(endTimeStr);
  return endMins <= startMins;
}

/**
 * Given a shift start time, end time, and reference timestamp,
 * calculates the authoritative shift occurrence and logical attendance date
 * in the target business timezone (defaulting to Asia/Dubai).
 */
export function resolveShiftOccurrence(
  startTimeStr?: string | null,
  endTimeStr?: string | null,
  refDate: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
  earlyCheckInBufferMins: number = 120, // 2 hours early check-in allowed
  overtimeBufferMins: number = 240,     // 4 hours overtime checkout allowed
): ShiftOccurrence {
  const comp = getDateComponentsInTimezone(refDate, timeZone);
  const nowMins = comp.hours * 60 + comp.minutes;

  // If no shift timing, treat as standard calendar day
  if (!startTimeStr || !endTimeStr) {
    const todayDateStr = `${comp.year}-${String(comp.month).padStart(2, '0')}-${String(comp.day).padStart(2, '0')}`;
    const todayDate = new Date(Date.UTC(comp.year, comp.month - 1, comp.day, 0, 0, 0, 0));
    const startOfToday = createDateInTimezone(comp.year, comp.month, comp.day, 0, 0, 0, timeZone);
    const endOfToday = createDateInTimezone(comp.year, comp.month, comp.day, 23, 59, 59, timeZone);
    return {
      shiftDateStr: todayDateStr,
      shiftDate: todayDate,
      scheduledStart: startOfToday,
      scheduledEnd: endOfToday,
      windowStart: startOfToday,
      windowEnd: endOfToday,
      isOvernight: false,
      isWithinWindow: true,
    };
  }

  const startMins = parseTimeToMinutes(startTimeStr);
  const endMins = parseTimeToMinutes(endTimeStr);
  const overnight = endMins <= startMins;

  const startHours = Math.floor(startMins / 60);
  const startRemainderMins = startMins % 60;
  const endHours = Math.floor(endMins / 60);
  const endRemainderMins = endMins % 60;

  if (overnight) {
    // Overnight Shift (e.g. 22:00 to 09:00)
    // There are two candidate shift occurrences touching "today":
    // 1) Occurrence starting Yesterday (Day D-1), ending Today (Day D) at endMins
    // 2) Occurrence starting Today (Day D), ending Tomorrow (Day D+1) at endMins

    // Cutoff boundary for morning: past midnight up to scheduledEnd + overtimeBuffer
    // E.g. endMins = 09:00 (540m) + 240m buffer = 780m (13:00 / 1:00 PM)
    if (nowMins < endMins + overtimeBufferMins) {
      // Current time is in the morning portion of the shift that started on Day D-1
      const yesterdayUtc = new Date(Date.UTC(comp.year, comp.month - 1, comp.day, 0, 0, 0, 0));
      yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
      const yComp = getDateComponentsInTimezone(yesterdayUtc, 'UTC');
      const yYear = yComp.year;
      const yMonth = yComp.month;
      const yDay = yComp.day;

      const shiftDateStr = `${yYear}-${String(yMonth).padStart(2, '0')}-${String(yDay).padStart(2, '0')}`;
      const shiftDate = new Date(Date.UTC(yYear, yMonth - 1, yDay, 0, 0, 0, 0));

      const scheduledStart = createDateInTimezone(yYear, yMonth, yDay, startHours, startRemainderMins, 0, timeZone);
      const scheduledEnd = createDateInTimezone(comp.year, comp.month, comp.day, endHours, endRemainderMins, 0, timeZone);

      const windowStart = new Date(scheduledStart.getTime() - earlyCheckInBufferMins * 60000);
      const windowEnd = new Date(scheduledEnd.getTime() + overtimeBufferMins * 60000);
      const isWithinWindow = refDate.getTime() >= windowStart.getTime() && refDate.getTime() <= windowEnd.getTime();

      return {
        shiftDateStr,
        shiftDate,
        scheduledStart,
        scheduledEnd,
        windowStart,
        windowEnd,
        isOvernight: true,
        isWithinWindow,
      };
    } else {
      // Current time is afternoon or evening, shift starts today (Day D), ends tomorrow (Day D+1)
      const shiftDateStr = `${comp.year}-${String(comp.month).padStart(2, '0')}-${String(comp.day).padStart(2, '0')}`;
      const shiftDate = new Date(Date.UTC(comp.year, comp.month - 1, comp.day, 0, 0, 0, 0));

      const tomorrowUtc = new Date(Date.UTC(comp.year, comp.month - 1, comp.day, 0, 0, 0, 0));
      tomorrowUtc.setUTCDate(tomorrowUtc.getUTCDate() + 1);
      const tComp = getDateComponentsInTimezone(tomorrowUtc, 'UTC');

      const scheduledStart = createDateInTimezone(comp.year, comp.month, comp.day, startHours, startRemainderMins, 0, timeZone);
      const scheduledEnd = createDateInTimezone(tComp.year, tComp.month, tComp.day, endHours, endRemainderMins, 0, timeZone);

      const windowStart = new Date(scheduledStart.getTime() - earlyCheckInBufferMins * 60000);
      const windowEnd = new Date(scheduledEnd.getTime() + overtimeBufferMins * 60000);
      const isWithinWindow = refDate.getTime() >= windowStart.getTime() && refDate.getTime() <= windowEnd.getTime();

      return {
        shiftDateStr,
        shiftDate,
        scheduledStart,
        scheduledEnd,
        windowStart,
        windowEnd,
        isOvernight: true,
        isWithinWindow,
      };
    }
  }

  // Day Shift (e.g. 09:00 to 18:00)
  const shiftDateStr = `${comp.year}-${String(comp.month).padStart(2, '0')}-${String(comp.day).padStart(2, '0')}`;
  const shiftDate = new Date(Date.UTC(comp.year, comp.month - 1, comp.day, 0, 0, 0, 0));

  const scheduledStart = createDateInTimezone(comp.year, comp.month, comp.day, startHours, startRemainderMins, 0, timeZone);
  const scheduledEnd = createDateInTimezone(comp.year, comp.month, comp.day, endHours, endRemainderMins, 0, timeZone);

  const windowStart = new Date(scheduledStart.getTime() - earlyCheckInBufferMins * 60000);
  const windowEnd = new Date(scheduledEnd.getTime() + overtimeBufferMins * 60000);
  const isWithinWindow = refDate.getTime() >= windowStart.getTime() && refDate.getTime() <= windowEnd.getTime();

  return {
    shiftDateStr,
    shiftDate,
    scheduledStart,
    scheduledEnd,
    windowStart,
    windowEnd,
    isOvernight: false,
    isWithinWindow,
  };
}

/**
 * Resolves the employee's active shift occurrence context from their assignments.
 * Prioritizes:
 * 1. Matching target assignmentId / shiftId if provided
 * 2. Assignment whose scheduled occurrence window covers refDate
 * 3. Primary active assignment
 */
export function resolveShiftAttendanceContext(
  assignments: any[],
  refDate: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE,
  targetAssignmentId?: string | null,
  targetShiftId?: string | null,
): ShiftContext {
  const activeAssignments = (assignments || []).filter((a) => a.isActive !== false);

  let chosenAssignment: any | null = null;

  if (targetAssignmentId) {
    chosenAssignment = activeAssignments.find((a) => a.id === targetAssignmentId) || null;
  }
  if (!chosenAssignment && targetShiftId) {
    chosenAssignment = activeAssignments.find((a) => a.shiftId === targetShiftId || a.shift?.id === targetShiftId) || null;
  }

  if (!chosenAssignment && activeAssignments.length > 0) {
    // If only 1 assignment, choose it
    if (activeAssignments.length === 1) {
      chosenAssignment = activeAssignments[0];
    } else {
      // Multiple assignments: test which occurrence window contains refDate
      const matching = activeAssignments.filter((a) => {
        if (!a.shift?.startTime || !a.shift?.endTime) return false;
        const occ = resolveShiftOccurrence(a.shift.startTime, a.shift.endTime, refDate, timeZone);
        return occ.isWithinWindow;
      });

      if (matching.length === 1) {
        chosenAssignment = matching[0];
      } else {
        // Do not arbitrarily assign if multiple assignments exist; choose the primary active one
        chosenAssignment =
          activeAssignments.find((a) => a.site && a.shift) ||
          activeAssignments[0] ||
          null;
      }
    }
  }

  const shift = chosenAssignment?.shift || null;
  const occurrence = shift?.startTime && shift?.endTime
    ? resolveShiftOccurrence(shift.startTime, shift.endTime, refDate, timeZone)
    : resolveShiftOccurrence(null, null, refDate, timeZone);

  return {
    shiftDateStr: occurrence.shiftDateStr,
    shiftDate: occurrence.shiftDate,
    shift,
    assignment: chosenAssignment,
    occurrence,
    isOvernight: occurrence.isOvernight,
  };
}
