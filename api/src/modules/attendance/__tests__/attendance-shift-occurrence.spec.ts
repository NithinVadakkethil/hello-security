import {
  parseTimeToMinutes,
  isShiftOvernight,
  resolveShiftOccurrence,
  resolveShiftAttendanceContext,
} from '../attendance-shift.util';
import { createDateInTimezone } from '../../../common/utils/date-formatter.util';

describe('Shift-Based Attendance Occurrence & Overnight Calculations', () => {
  const DUBAI_TZ = 'Asia/Dubai';

  describe('parseTimeToMinutes', () => {
    it('parses 24-hour and 12-hour AM/PM formats accurately', () => {
      expect(parseTimeToMinutes('22:00')).toBe(1320);
      expect(parseTimeToMinutes('09:00')).toBe(540);
      expect(parseTimeToMinutes('10:00 PM')).toBe(1320);
      expect(parseTimeToMinutes('9:00 AM')).toBe(540);
      expect(parseTimeToMinutes('12:00 AM')).toBe(0);
      expect(parseTimeToMinutes('12:00 PM')).toBe(720);
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('21:30')).toBe(1290);
      expect(parseTimeToMinutes('06:00')).toBe(360);
      expect(parseTimeToMinutes(null)).toBe(0);
    });
  });

  describe('isShiftOvernight', () => {
    it('correctly identifies day shifts and overnight shifts', () => {
      // 1. Day shift: 9:00 AM to 6:00 PM
      expect(isShiftOvernight('09:00', '18:00')).toBe(false);
      expect(isShiftOvernight('9:00 AM', '6:00 PM')).toBe(false);

      // 2. Night shift: 10:00 PM to 9:00 AM
      expect(isShiftOvernight('22:00', '09:00')).toBe(true);
      expect(isShiftOvernight('10:00 PM', '9:00 AM')).toBe(true);

      // 3. Night shift: 9:00 PM to 6:00 AM
      expect(isShiftOvernight('21:00', '06:00')).toBe(true);
      expect(isShiftOvernight('9:00 PM', '6:00 AM')).toBe(true);
    });
  });

  describe('resolveShiftOccurrence — Day Shift (09:00 to 18:00)', () => {
    it('associates day shift with current calendar date', () => {
      // 12 Nov 2026, 08:30 AM (30 min early check-in)
      const tEarly = createDateInTimezone(2026, 11, 12, 8, 30, 0, DUBAI_TZ);
      const occEarly = resolveShiftOccurrence('09:00', '18:00', tEarly, DUBAI_TZ);
      expect(occEarly.shiftDateStr).toBe('2026-11-12');
      expect(occEarly.isOvernight).toBe(false);
      expect(occEarly.isWithinWindow).toBe(true);

      // 12 Nov 2026, 12:00 PM (midday)
      const tMid = createDateInTimezone(2026, 11, 12, 12, 0, 0, DUBAI_TZ);
      const occMid = resolveShiftOccurrence('09:00', '18:00', tMid, DUBAI_TZ);
      expect(occMid.shiftDateStr).toBe('2026-11-12');

      // 12 Nov 2026, 18:30 PM (checkout 30 min after shift end)
      const tOut = createDateInTimezone(2026, 11, 12, 18, 30, 0, DUBAI_TZ);
      const occOut = resolveShiftOccurrence('09:00', '18:00', tOut, DUBAI_TZ);
      expect(occOut.shiftDateStr).toBe('2026-11-12');
      expect(occOut.isWithinWindow).toBe(true);
    });
  });

  describe('resolveShiftOccurrence — Night Shift (22:00 to 09:00)', () => {
    it('4. associates check-in before midnight with shift start date (12 Nov 2026)', () => {
      // 12 Nov 2026, 21:45 (15 mins early check-in)
      const tCheckIn = createDateInTimezone(2026, 11, 12, 21, 45, 0, DUBAI_TZ);
      const occ = resolveShiftOccurrence('22:00', '09:00', tCheckIn, DUBAI_TZ);

      expect(occ.shiftDateStr).toBe('2026-11-12');
      expect(occ.isOvernight).toBe(true);
      expect(occ.isWithinWindow).toBe(true);
    });

    it('5. & 6. keeps shiftDateStr as 12 Nov after midnight at 00:05, 03:00, and 08:30', () => {
      // 13 Nov 2026, 00:05 (5 minutes after midnight)
      const tMidnight = createDateInTimezone(2026, 11, 13, 0, 5, 0, DUBAI_TZ);
      const occMidnight = resolveShiftOccurrence('22:00', '09:00', tMidnight, DUBAI_TZ);
      expect(occMidnight.shiftDateStr).toBe('2026-11-12');
      expect(occMidnight.isOvernight).toBe(true);
      expect(occMidnight.isWithinWindow).toBe(true);

      // 13 Nov 2026, 03:30 (middle of the night)
      const tNight = createDateInTimezone(2026, 11, 13, 3, 30, 0, DUBAI_TZ);
      const occNight = resolveShiftOccurrence('22:00', '09:00', tNight, DUBAI_TZ);
      expect(occNight.shiftDateStr).toBe('2026-11-12');
      expect(occNight.isWithinWindow).toBe(true);

      // 13 Nov 2026, 08:45 (morning before shift end)
      const tMorning = createDateInTimezone(2026, 11, 13, 8, 45, 0, DUBAI_TZ);
      const occMorning = resolveShiftOccurrence('22:00', '09:00', tMorning, DUBAI_TZ);
      expect(occMorning.shiftDateStr).toBe('2026-11-12');
      expect(occMorning.isWithinWindow).toBe(true);
    });

    it('7. & 8. keeps shiftDateStr as 12 Nov at shift checkout (09:00 AM on 13 Nov)', () => {
      // 13 Nov 2026, 09:00 AM (exact checkout)
      const tCheckOut = createDateInTimezone(2026, 11, 13, 9, 0, 0, DUBAI_TZ);
      const occ = resolveShiftOccurrence('22:00', '09:00', tCheckOut, DUBAI_TZ);

      expect(occ.shiftDateStr).toBe('2026-11-12');
      expect(occ.isOvernight).toBe(true);
      expect(occ.isWithinWindow).toBe(true);
    });

    it('12. supports overtime checkout up to 4 hours past scheduled shift end', () => {
      // 13 Nov 2026, 10:30 AM (1h 30m overtime)
      const tOvertime = createDateInTimezone(2026, 11, 13, 10, 30, 0, DUBAI_TZ);
      const occ = resolveShiftOccurrence('22:00', '09:00', tOvertime, DUBAI_TZ);

      expect(occ.shiftDateStr).toBe('2026-11-12');
      expect(occ.isWithinWindow).toBe(true);

      // 13 Nov 2026, 12:45 PM (3h 45m overtime, still within 4h buffer)
      const tLateOvertime = createDateInTimezone(2026, 11, 13, 12, 45, 0, DUBAI_TZ);
      const occLate = resolveShiftOccurrence('22:00', '09:00', tLateOvertime, DUBAI_TZ);
      expect(occLate.shiftDateStr).toBe('2026-11-12');
      expect(occLate.isWithinWindow).toBe(true);

      // 13 Nov 2026, 14:00 PM (off-duty, past overtime buffer; switches to upcoming shift)
      const tAfternoon = createDateInTimezone(2026, 11, 13, 14, 0, 0, DUBAI_TZ);
      const occAfternoon = resolveShiftOccurrence('22:00', '09:00', tAfternoon, DUBAI_TZ);
      expect(occAfternoon.shiftDateStr).toBe('2026-11-13');
    });
  });

  describe('resolveShiftOccurrence — Month-End & Year-End Boundaries', () => {
    it('15. correctly handles overnight shift crossing month-end (30 Nov to 1 Dec)', () => {
      // Check-in on 30 Nov at 22:00
      const tCheckIn = createDateInTimezone(2026, 11, 30, 22, 0, 0, DUBAI_TZ);
      const occIn = resolveShiftOccurrence('22:00', '09:00', tCheckIn, DUBAI_TZ);
      expect(occIn.shiftDateStr).toBe('2026-11-30');

      // Post-midnight on 1 Dec at 02:30 AM
      const tMidnight = createDateInTimezone(2026, 12, 1, 2, 30, 0, DUBAI_TZ);
      const occMid = resolveShiftOccurrence('22:00', '09:00', tMidnight, DUBAI_TZ);
      expect(occMid.shiftDateStr).toBe('2026-11-30');

      // Checkout on 1 Dec at 09:00 AM
      const tOut = createDateInTimezone(2026, 12, 1, 9, 0, 0, DUBAI_TZ);
      const occOut = resolveShiftOccurrence('22:00', '09:00', tOut, DUBAI_TZ);
      expect(occOut.shiftDateStr).toBe('2026-11-30');
    });

    it('16. correctly handles overnight shift crossing year-end (31 Dec to 1 Jan)', () => {
      // Check-in on 31 Dec 2026 at 22:00
      const tCheckIn = createDateInTimezone(2026, 12, 31, 22, 0, 0, DUBAI_TZ);
      const occIn = resolveShiftOccurrence('22:00', '09:00', tCheckIn, DUBAI_TZ);
      expect(occIn.shiftDateStr).toBe('2026-12-31');

      // Post-midnight on 1 Jan 2027 at 03:00 AM
      const tMidnight = createDateInTimezone(2027, 1, 1, 3, 0, 0, DUBAI_TZ);
      const occMid = resolveShiftOccurrence('22:00', '09:00', tMidnight, DUBAI_TZ);
      expect(occMid.shiftDateStr).toBe('2026-12-31');

      // Checkout on 1 Jan 2027 at 09:15 AM
      const tOut = createDateInTimezone(2027, 1, 1, 9, 15, 0, DUBAI_TZ);
      const occOut = resolveShiftOccurrence('22:00', '09:00', tOut, DUBAI_TZ);
      expect(occOut.shiftDateStr).toBe('2026-12-31');
    });
  });

  describe('resolveShiftAttendanceContext — Multiple Assignments & Unassigned Employees', () => {
    const mockDayAssignment = {
      id: 'asg-day',
      isActive: true,
      shiftId: 'shift-day',
      shift: { id: 'shift-day', name: 'Day Shift', startTime: '08:00', endTime: '16:00' },
      site: { id: 'site-1', name: 'Tower A' },
    };

    const mockNightAssignment = {
      id: 'asg-night',
      isActive: true,
      shiftId: 'shift-night',
      shift: { id: 'shift-night', name: 'Night Shift', startTime: '22:00', endTime: '06:00' },
      site: { id: 'site-1', name: 'Tower A' },
    };

    it('13. respects explicit assignmentId when requested', () => {
      const t = createDateInTimezone(2026, 11, 12, 10, 0, 0, DUBAI_TZ);
      const ctx = resolveShiftAttendanceContext(
        [mockDayAssignment, mockNightAssignment],
        t,
        DUBAI_TZ,
        'asg-night'
      );
      expect(ctx.assignment?.id).toBe('asg-night');
      expect(ctx.shift?.name).toBe('Night Shift');
    });

    it('14. automatically selects active shift window when multiple assignments exist', () => {
      // At 09:00 AM, Day Shift is active
      const tMorning = createDateInTimezone(2026, 11, 12, 9, 0, 0, DUBAI_TZ);
      const ctxMorning = resolveShiftAttendanceContext(
        [mockDayAssignment, mockNightAssignment],
        tMorning,
        DUBAI_TZ
      );
      expect(ctxMorning.assignment?.id).toBe('asg-day');
      expect(ctxMorning.shiftDateStr).toBe('2026-11-12');

      // At 23:00 PM, Night Shift is active
      const tNight = createDateInTimezone(2026, 11, 12, 23, 0, 0, DUBAI_TZ);
      const ctxNight = resolveShiftAttendanceContext(
        [mockDayAssignment, mockNightAssignment],
        tNight,
        DUBAI_TZ
      );
      expect(ctxNight.assignment?.id).toBe('asg-night');
      expect(ctxNight.shiftDateStr).toBe('2026-11-12');
    });

    it('handles employees with no valid shift assignment (unassigned)', () => {
      const t = createDateInTimezone(2026, 11, 12, 14, 0, 0, DUBAI_TZ);
      const ctx = resolveShiftAttendanceContext([], t, DUBAI_TZ);
      expect(ctx.shiftDateStr).toBe('2026-11-12');
      expect(ctx.assignment).toBeNull();
      expect(ctx.shift).toBeNull();
      expect(ctx.isOvernight).toBe(false);
    });
  });
});

