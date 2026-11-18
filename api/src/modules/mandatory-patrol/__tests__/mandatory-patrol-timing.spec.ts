import {
  normalizeTimeInput,
  parseTimeToMinutes,
  calculateMandatoryWindow,
  getEffectiveShiftDate,
  isValidTimeFormat,
} from '../mandatory-patrol.util';
import { createShiftSchema, updateShiftSchema } from '../../shift/shift.schema';
import { formatPatrolTime } from '../../../common/utils/date-formatter.util';

describe('Mandatory Patrol Timing & Normalization Suite', () => {
  describe('1. normalizeTimeInput & parseTimeToMinutes', () => {
    it('normalizes bare hours to HH:mm format', () => {
      expect(normalizeTimeInput('11')).toBe('11:00');
      expect(normalizeTimeInput('18')).toBe('18:00');
      expect(normalizeTimeInput('0')).toBe('00:00');
      expect(normalizeTimeInput('9')).toBe('09:00');
      expect(normalizeTimeInput('08')).toBe('08:00');
      expect(normalizeTimeInput('23')).toBe('23:00');
    });

    it('normalizes standard 24-hour times', () => {
      expect(normalizeTimeInput('08:00')).toBe('08:00');
      expect(normalizeTimeInput('8:00')).toBe('08:00');
      expect(normalizeTimeInput('18:30')).toBe('18:30');
      expect(normalizeTimeInput('00:00')).toBe('00:00');
      expect(normalizeTimeInput('23:59')).toBe('23:59');
    });

    it('normalizes 12-hour AM/PM times', () => {
      expect(normalizeTimeInput('11:00 AM')).toBe('11:00');
      expect(normalizeTimeInput('11:00 am')).toBe('11:00');
      expect(normalizeTimeInput('11 AM')).toBe('11:00');
      expect(normalizeTimeInput('6:00 PM')).toBe('18:00');
      expect(normalizeTimeInput('6 PM')).toBe('18:00');
      expect(normalizeTimeInput('12:00 AM')).toBe('00:00');
      expect(normalizeTimeInput('12:00 PM')).toBe('12:00');
      expect(normalizeTimeInput('12:30 AM')).toBe('00:30');
      expect(normalizeTimeInput('12:30 PM')).toBe('12:30');
      expect(normalizeTimeInput('1:15 PM')).toBe('13:15');
    });

    it('rejects invalid time inputs returning null', () => {
      expect(normalizeTimeInput('24')).toBeNull();
      expect(normalizeTimeInput('25:00')).toBeNull();
      expect(normalizeTimeInput('-1')).toBeNull();
      expect(normalizeTimeInput('11:60')).toBeNull();
      expect(normalizeTimeInput('11:65')).toBeNull();
      expect(normalizeTimeInput('abc')).toBeNull();
      expect(normalizeTimeInput('11:xx')).toBeNull();
      expect(normalizeTimeInput(':30')).toBeNull();
      expect(normalizeTimeInput('11:')).toBeNull();
      expect(normalizeTimeInput('13:00 PM')).toBeNull();
      expect(normalizeTimeInput('0:00 AM')).toBeNull();
      expect(normalizeTimeInput('')).toBeNull();
      expect(normalizeTimeInput('   ')).toBeNull();
      expect(normalizeTimeInput(null)).toBeNull();
      expect(normalizeTimeInput(undefined)).toBeNull();
    });

    it('parses valid times to minutes from midnight', () => {
      // Critical bug regression check: bare hours MUST NOT return 0 (midnight)
      expect(parseTimeToMinutes('11')).toBe(11 * 60); // 660
      expect(parseTimeToMinutes('18')).toBe(18 * 60); // 1080
      expect(parseTimeToMinutes('08:00')).toBe(8 * 60); // 480
      expect(parseTimeToMinutes('18:30')).toBe(18 * 60 + 30); // 1110
      expect(parseTimeToMinutes('11:00 AM')).toBe(11 * 60); // 660
      expect(parseTimeToMinutes('6:00 PM')).toBe(18 * 60); // 1080

      // Explicit midnight returns 0
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('0')).toBe(0);
      expect(parseTimeToMinutes('12:00 AM')).toBe(0);

      // Invalid/empty inputs return null (NEVER silently 0)
      expect(parseTimeToMinutes('24')).toBeNull();
      expect(parseTimeToMinutes('abc')).toBeNull();
      expect(parseTimeToMinutes('')).toBeNull();
      expect(parseTimeToMinutes(null)).toBeNull();
    });
  });

  describe('2. calculateMandatoryWindow in Asia/Dubai', () => {
    const shiftDate = new Date('2026-11-16T00:00:00.000Z');
    const timeZone = 'Asia/Dubai';

    it('calculates Patrol 1 (Required: 11, Window: -15/+60) as 11:00 AM (10:45 AM - 12:00 PM Dubai)', () => {
      const window1 = calculateMandatoryWindow(
        '08:00',
        '20:00',
        shiftDate,
        '11', // bare hour
        15,
        60,
        timeZone,
      );

      expect(window1).not.toBeNull();
      // Dubai is UTC+4. 11:00 AM Dubai is 07:00 UTC.
      expect(window1!.scheduledAt.toISOString()).toBe('2026-11-16T07:00:00.000Z');
      // Window start: 10:45 AM Dubai (06:45 UTC)
      expect(window1!.windowStart.toISOString()).toBe('2026-11-16T06:45:00.000Z');
      // Window end: 12:00 PM Dubai (08:00 UTC)
      expect(window1!.windowEnd.toISOString()).toBe('2026-11-16T08:00:00.000Z');

      // Verify formatted strings matching mobile display
      expect(formatPatrolTime(window1!.scheduledAt, timeZone, false)).toBe('11:00 AM');
      expect(formatPatrolTime(window1!.windowStart, timeZone, false)).toBe('10:45 AM');
      expect(formatPatrolTime(window1!.windowEnd, timeZone, false)).toBe('12:00 PM');
    });

    it('calculates Patrol 2 (Required: 18, Window: -15/+60) as 6:00 PM (5:45 PM - 7:00 PM Dubai)', () => {
      const window2 = calculateMandatoryWindow(
        '08:00',
        '20:00',
        shiftDate,
        '18', // bare hour
        15,
        60,
        timeZone,
      );

      expect(window2).not.toBeNull();
      // Dubai is UTC+4. 18:00 (6:00 PM) Dubai is 14:00 UTC.
      expect(window2!.scheduledAt.toISOString()).toBe('2026-11-16T14:00:00.000Z');
      // Window start: 5:45 PM Dubai (13:45 UTC)
      expect(window2!.windowStart.toISOString()).toBe('2026-11-16T13:45:00.000Z');
      // Window end: 7:00 PM Dubai (15:00 UTC)
      expect(window2!.windowEnd.toISOString()).toBe('2026-11-16T15:00:00.000Z');

      // Verify formatted strings matching mobile display
      expect(formatPatrolTime(window2!.scheduledAt, timeZone, false)).toBe('6:00 PM');
      expect(formatPatrolTime(window2!.windowStart, timeZone, false)).toBe('5:45 PM');
      expect(formatPatrolTime(window2!.windowEnd, timeZone, false)).toBe('7:00 PM');
    });

    it('returns null on invalid target time and never defaults to midnight', () => {
      const windowInvalid = calculateMandatoryWindow(
        '08:00',
        '20:00',
        shiftDate,
        '24',
        15,
        60,
        timeZone,
      );
      expect(windowInvalid).toBeNull();

      const windowGarbage = calculateMandatoryWindow(
        '08:00',
        '20:00',
        shiftDate,
        'abc',
        15,
        60,
        timeZone,
      );
      expect(windowGarbage).toBeNull();
    });

    it('correctly handles explicit midnight patrol ("00:00")', () => {
      const midnightWindow = calculateMandatoryWindow(
        '20:00',
        '08:00',
        shiftDate,
        '00:00',
        15,
        15,
        timeZone,
      );
      expect(midnightWindow).not.toBeNull();
      // For overnight shift 20:00 - 08:00, 00:00 falls on next calendar day in Dubai (Nov 17 00:00 Dubai = Nov 16 20:00 UTC)
      expect(midnightWindow!.scheduledAt.toISOString()).toBe('2026-11-16T20:00:00.000Z');
      expect(formatPatrolTime(midnightWindow!.scheduledAt, timeZone, false)).toBe('12:00 AM');
    });
  });

  describe('3. Status Evaluation at 4:05 PM Dubai time', () => {
    const shiftDate = new Date('2026-11-16T00:00:00.000Z');
    const timeZone = 'Asia/Dubai';

    // 4:05 PM Dubai time (16:05 Dubai = 12:05 UTC)
    const at405PMDubai = new Date('2026-11-16T12:05:00.000Z');

    it('evaluates Patrol 1 as MISSED (window closed at 12:00 PM) and Patrol 2 as UPCOMING (window opens at 5:45 PM)', () => {
      const window1 = calculateMandatoryWindow('08:00', '20:00', shiftDate, '11', 15, 60, timeZone)!;
      const window2 = calculateMandatoryWindow('08:00', '20:00', shiftDate, '18', 15, 60, timeZone)!;

      // Status helper simulating evaluateMandatoryPatrolStatuses
      const evaluateStatus = (now: Date, win: { windowStart: Date; windowEnd: Date }, completed = false) => {
        if (completed) return 'COMPLETED';
        if (now < win.windowStart) return 'UPCOMING';
        if (now <= win.windowEnd) return 'DUE';
        return 'MISSED';
      };

      // At 4:05 PM Dubai time:
      // Patrol 1 window ended at 12:00 PM Dubai (08:00 UTC) -> 12:05 UTC > 08:00 UTC => MISSED
      const status1 = evaluateStatus(at405PMDubai, window1, false);
      expect(status1).toBe('MISSED');

      // If Patrol 1 was completed, it remains COMPLETED
      const status1Completed = evaluateStatus(at405PMDubai, window1, true);
      expect(status1Completed).toBe('COMPLETED');

      // Patrol 2 window starts at 5:45 PM Dubai (13:45 UTC) -> 12:05 UTC < 13:45 UTC => UPCOMING
      const status2 = evaluateStatus(at405PMDubai, window2, false);
      expect(status2).toBe('UPCOMING');
    });

    it('evaluates Patrol 1 as DUE at 11:15 AM Dubai time', () => {
      const at1115AMDubai = new Date('2026-11-16T07:15:00.000Z');
      const window1 = calculateMandatoryWindow('08:00', '20:00', shiftDate, '11', 15, 60, timeZone)!;

      const evaluateStatus = (now: Date, win: { windowStart: Date; windowEnd: Date }) => {
        if (now < win.windowStart) return 'UPCOMING';
        if (now <= win.windowEnd) return 'DUE';
        return 'MISSED';
      };

      expect(evaluateStatus(at1115AMDubai, window1)).toBe('DUE');
    });

    it('evaluates Patrol 2 as DUE at 6:15 PM Dubai time', () => {
      const at615PMDubai = new Date('2026-11-16T14:15:00.000Z');
      const window2 = calculateMandatoryWindow('08:00', '20:00', shiftDate, '18', 15, 60, timeZone)!;

      const evaluateStatus = (now: Date, win: { windowStart: Date; windowEnd: Date }) => {
        if (now < win.windowStart) return 'UPCOMING';
        if (now <= win.windowEnd) return 'DUE';
        return 'MISSED';
      };

      expect(evaluateStatus(at615PMDubai, window2)).toBe('DUE');
    });
  });

  describe('4. Overnight Shift Date & Window Handling', () => {
    const timeZone = 'Asia/Dubai';

    it('correctly schedules early morning patrol on the next calendar day in overnight shifts', () => {
      const shiftDate = new Date('2026-11-16T00:00:00.000Z');
      // Night shift: 22:00 to 06:00
      // Patrol 1: 23:00 (Nov 16 evening)
      // Patrol 2: 03:00 (Nov 17 morning)
      const window1 = calculateMandatoryWindow('22:00', '06:00', shiftDate, '23:00', 15, 15, timeZone);
      const window2 = calculateMandatoryWindow('22:00', '06:00', shiftDate, '03:00', 15, 15, timeZone);

      expect(window1).not.toBeNull();
      expect(window2).not.toBeNull();

      // Patrol 1: Nov 16 23:00 Dubai = Nov 16 19:00 UTC
      expect(window1!.scheduledAt.toISOString()).toBe('2026-11-16T19:00:00.000Z');
      // Patrol 2: Nov 17 03:00 Dubai = Nov 16 23:00 UTC
      expect(window2!.scheduledAt.toISOString()).toBe('2026-11-16T23:00:00.000Z');

      expect(formatPatrolTime(window1!.scheduledAt, timeZone, false)).toBe('11:00 PM');
      expect(formatPatrolTime(window2!.scheduledAt, timeZone, false)).toBe('3:00 AM');
    });

    it('resolves effective shift date correctly when employee is active after midnight', () => {
      // Overnight shift 22:00 to 06:00.
      // At 02:00 AM on Nov 17 Dubai time (Nov 16 22:00 UTC),
      // the effective shift date should still be Nov 16 (the shift start date).
      const at2AMNov17Dubai = new Date('2026-11-16T22:00:00.000Z');
      const effectiveDate = getEffectiveShiftDate('22:00', '06:00', at2AMNov17Dubai, timeZone);

      expect(effectiveDate.toISOString().slice(0, 10)).toBe('2026-11-16');
    });
  });

  describe('5. Zod Schema Validation & Transformation', () => {
    it('normalizes bare hours to HH:mm in createShiftSchema', () => {
      const input = {
        name: 'Security - Day',
        startTime: '08:00',
        endTime: '20:00',
        mandatoryPatrol1Time: '11',
        mandatoryPatrol1WindowBefore: 15,
        mandatoryPatrol1WindowAfter: 60,
        mandatoryPatrol2Time: '18',
        mandatoryPatrol2WindowBefore: 15,
        mandatoryPatrol2WindowAfter: 60,
      };

      const parsed = createShiftSchema.parse(input);
      expect(parsed.mandatoryPatrol1Time).toBe('11:00');
      expect(parsed.mandatoryPatrol2Time).toBe('18:00');
      expect(parsed.startTime).toBe('08:00');
      expect(parsed.endTime).toBe('20:00');
    });

    it('normalizes 12-hour AM/PM inputs in createShiftSchema', () => {
      const input = {
        name: 'Security - Day',
        startTime: '8:00 AM',
        endTime: '8:00 PM',
        mandatoryPatrol1Time: '11:00 AM',
        mandatoryPatrol2Time: '6:00 PM',
      };

      const parsed = createShiftSchema.parse(input);
      expect(parsed.startTime).toBe('08:00');
      expect(parsed.endTime).toBe('20:00');
      expect(parsed.mandatoryPatrol1Time).toBe('11:00');
      expect(parsed.mandatoryPatrol2Time).toBe('18:00');
    });

    it('rejects invalid patrol times in createShiftSchema with clear error message', () => {
      const invalidInput = {
        name: 'Security - Day',
        startTime: '08:00',
        endTime: '20:00',
        mandatoryPatrol1Time: '24',
      };

      const result = createShiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Must be a valid time (e.g. 11:00, 18:00, or 11)');
      }
    });

    it('rejects garbage strings in mandatoryPatrol2Time', () => {
      const invalidInput = {
        name: 'Security - Day',
        startTime: '08:00',
        endTime: '20:00',
        mandatoryPatrol2Time: 'invalid-time',
      };

      const result = createShiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Must be a valid time (e.g. 11:00, 18:00, or 11)');
      }
    });

    it('allows empty / null mandatory patrol times in updateShiftSchema', () => {
      const parsed = updateShiftSchema.parse({
        mandatoryPatrol1Time: '',
        mandatoryPatrol2Time: null,
      });
      expect(parsed.mandatoryPatrol1Time).toBeNull();
      expect(parsed.mandatoryPatrol2Time).toBeNull();
    });
  });

  describe('6. Historical False Missed Records Identification Criteria', () => {
    it('accurately identifies corrupted midnight instances for non-midnight shift definitions', () => {
      // Simulating database records:
      // Case A: Shift has mandatoryPatrol1Time = '11', but instance scheduledAt was midnight (corrupted)
      const corruptedInstance = {
        id: 'inst-corrupted-1',
        sequence: 1,
        status: 'MISSED',
        scheduledAt: new Date('2026-11-15T20:00:00.000Z'), // 00:00:00 Dubai on Nov 16
        shift: {
          mandatoryPatrol1Time: '11',
          mandatoryPatrol2Time: '18',
        },
      };

      // Case B: Shift has mandatoryPatrol1Time = '00:00', instance scheduledAt was midnight (legitimate)
      const legitimateMidnightInstance = {
        id: 'inst-legit-midnight',
        sequence: 1,
        status: 'MISSED',
        scheduledAt: new Date('2026-11-15T20:00:00.000Z'), // 00:00:00 Dubai on Nov 16
        shift: {
          mandatoryPatrol1Time: '00:00',
          mandatoryPatrol2Time: null,
        },
      };

      // Detection logic:
      const isCorruptedFalseMissed = (inst: any, timeZone = 'Asia/Dubai') => {
        if (inst.status !== 'MISSED') return false;

        const scheduledTimeStr = formatPatrolTime(inst.scheduledAt, timeZone, false); // e.g. "12:00 AM"
        if (scheduledTimeStr !== '12:00 AM') return false;

        const shiftTime = inst.sequence === 1 ? inst.shift.mandatoryPatrol1Time : inst.shift.mandatoryPatrol2Time;
        const normalizedShiftTime = normalizeTimeInput(shiftTime);

        // If shift configured time is not midnight (00:00) but instance was scheduled at 12:00 AM, it is false missed!
        return normalizedShiftTime !== null && normalizedShiftTime !== '00:00';
      };

      expect(isCorruptedFalseMissed(corruptedInstance)).toBe(true);
      expect(isCorruptedFalseMissed(legitimateMidnightInstance)).toBe(false);
    });
  });
});

