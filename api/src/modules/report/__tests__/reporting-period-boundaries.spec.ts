import {
  getReportingPeriodBoundaries,
  calculateOverlapDurationSeconds,
} from '../../../common/utils/date-formatter.util';

describe('Reporting Period Resolver & Boundary Aggregation', () => {
  const DUBAI_TZ = 'Asia/Dubai';

  describe('1. DAILY Boundary Calculation', () => {
    it('should calculate local midnight to following local midnight in Asia/Dubai for 2026-10-28', () => {
      const result = getReportingPeriodBoundaries('DAILY', { date: '2026-10-28' }, DUBAI_TZ);

      // Start: 28 Oct 00:00 Dubai (UTC+4) -> 27 Oct 20:00:00Z
      expect(result.from.toISOString()).toBe('2026-10-27T20:00:00.000Z');
      // End (exclusive): 29 Oct 00:00 Dubai -> 28 Oct 20:00:00Z
      expect(result.to.toISOString()).toBe('2026-10-28T20:00:00.000Z');
      expect(result.to.getTime() - result.from.getTime()).toBe(24 * 60 * 60 * 1000);
      expect(result.startDateStr).toBe('2026-10-28');
      expect(result.endDateStr).toBe('2026-10-28');
      expect(result.periodLabel).toBe('28 Oct 2026');
    });
  });

  describe('2. WEEKLY Boundary Calculation', () => {
    it('should calculate Monday through Sunday with exclusive end at following Monday midnight in Asia/Dubai for week containing 2026-10-28', () => {
      // 28 Oct 2026 is a Wednesday. Week starts Monday 26 Oct 2026 and ends Sunday 1 Nov 2026.
      const result = getReportingPeriodBoundaries('WEEKLY', { date: '2026-10-28' }, DUBAI_TZ);

      // Start: Monday 26 Oct 00:00 Dubai -> 25 Oct 20:00:00Z
      expect(result.from.toISOString()).toBe('2026-10-25T20:00:00.000Z');
      // End (exclusive): Following Monday 2 Nov 00:00 Dubai -> 1 Nov 20:00:00Z
      expect(result.to.toISOString()).toBe('2026-11-01T20:00:00.000Z');
      expect(result.to.getTime() - result.from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
      expect(result.startDateStr).toBe('2026-10-26');
      expect(result.endDateStr).toBe('2026-11-01');
      expect(result.periodLabel).toBe('Week of 26 Oct 2026 – 1 Nov 2026');
    });

    it('should support explicit startDate and endDate provided by the week picker', () => {
      const result = getReportingPeriodBoundaries(
        'WEEKLY',
        { startDate: '2026-10-26', endDate: '2026-11-01' },
        DUBAI_TZ,
      );

      expect(result.from.toISOString()).toBe('2026-10-25T20:00:00.000Z');
      expect(result.to.toISOString()).toBe('2026-11-01T20:00:00.000Z');
      expect(result.startDateStr).toBe('2026-10-26');
      expect(result.endDateStr).toBe('2026-11-01');
    });
  });

  describe('3. MONTHLY Boundary Calculation', () => {
    it('should calculate first day of selected month through first day of following month (exclusive) in Asia/Dubai', () => {
      const result = getReportingPeriodBoundaries('MONTHLY', { month: '2026-10' }, DUBAI_TZ);

      // Start: 1 Oct 00:00 Dubai -> 30 Sep 20:00:00Z
      expect(result.from.toISOString()).toBe('2026-09-30T20:00:00.000Z');
      // End (exclusive): 1 Nov 00:00 Dubai -> 31 Oct 20:00:00Z
      expect(result.to.toISOString()).toBe('2026-10-31T20:00:00.000Z');
      expect(result.startDateStr).toBe('2026-10-01');
      expect(result.endDateStr).toBe('2026-10-31');
      expect(result.periodLabel).toBe('October 2026');
    });
  });

  describe('4. CUSTOM RANGE Boundary Calculation & Equivalences', () => {
    it('CUSTOM single-day range (2026-10-28 to 2026-10-28) matches DAILY (2026-10-28) exactly', () => {
      const daily = getReportingPeriodBoundaries('DAILY', { date: '2026-10-28' }, DUBAI_TZ);
      const custom = getReportingPeriodBoundaries(
        'CUSTOM',
        { startDate: '2026-10-28', endDate: '2026-10-28' },
        DUBAI_TZ,
      );

      expect(custom.from.toISOString()).toBe(daily.from.toISOString());
      expect(custom.to.toISOString()).toBe(daily.to.toISOString());
      expect(custom.startDateStr).toBe(daily.startDateStr);
      expect(custom.endDateStr).toBe(daily.endDateStr);
    });

    it('CUSTOM full-week range (2026-10-26 to 2026-11-01) matches WEEKLY (2026-10-28) exactly', () => {
      const weekly = getReportingPeriodBoundaries('WEEKLY', { date: '2026-10-28' }, DUBAI_TZ);
      const custom = getReportingPeriodBoundaries(
        'CUSTOM',
        { startDate: '2026-10-26', endDate: '2026-11-01' },
        DUBAI_TZ,
      );

      expect(custom.from.toISOString()).toBe(weekly.from.toISOString());
      expect(custom.to.toISOString()).toBe(weekly.to.toISOString());
      expect(custom.startDateStr).toBe(weekly.startDateStr);
      expect(custom.endDateStr).toBe(weekly.endDateStr);
    });

    it('CUSTOM full-month range (2026-10-01 to 2026-10-31) matches MONTHLY (2026-10) exactly', () => {
      const monthly = getReportingPeriodBoundaries('MONTHLY', { month: '2026-10' }, DUBAI_TZ);
      const custom = getReportingPeriodBoundaries(
        'CUSTOM',
        { startDate: '2026-10-01', endDate: '2026-10-31' },
        DUBAI_TZ,
      );

      expect(custom.from.toISOString()).toBe(monthly.from.toISOString());
      expect(custom.to.toISOString()).toBe(monthly.to.toISOString());
      expect(custom.startDateStr).toBe(monthly.startDateStr);
      expect(custom.endDateStr).toBe(monthly.endDateStr);
    });

    it('should reject Custom Range when To Date is earlier than From Date', () => {
      expect(() => {
        getReportingPeriodBoundaries(
          'CUSTOM',
          { startDate: '2026-10-28', endDate: '2026-10-20' },
          DUBAI_TZ,
        );
      }).toThrow('To Date cannot be earlier than From Date.');
    });

    it('should reject Custom Range when dates are missing', () => {
      expect(() => {
        getReportingPeriodBoundaries('CUSTOM', { startDate: '2026-10-28' }, DUBAI_TZ);
      }).toThrow('Both From Date and To Date are required for Custom Range reports.');
    });
  });

  describe('5. Midnight-Crossing Patrol Durations Overlap Policy', () => {
    it('correctly attributes duration across adjacent days without loss or double counting', () => {
      // Day 1: 2026-10-27 in Dubai (UTC window: 2026-10-26T20:00:00Z to 2026-10-27T20:00:00Z)
      const day1 = getReportingPeriodBoundaries('DAILY', { date: '2026-10-27' }, DUBAI_TZ);
      // Day 2: 2026-10-28 in Dubai (UTC window: 2026-10-27T20:00:00Z to 2026-10-28T20:00:00Z)
      const day2 = getReportingPeriodBoundaries('DAILY', { date: '2026-10-28' }, DUBAI_TZ);

      // Patrol starts 10 minutes before midnight Dubai time: 27 Oct 23:50 Dubai = 19:50:00Z
      const patrolStart = new Date('2026-10-27T19:50:00.000Z');
      // Patrol ends 20 minutes after midnight Dubai time: 28 Oct 00:20 Dubai = 20:20:00Z
      const patrolEnd = new Date('2026-10-27T20:20:00.000Z');
      const totalPatrolSeconds = 30 * 60; // 1800 sec

      // Overlap with Day 1: 19:50 to 20:00 = 10 min (600 sec)
      const day1Overlap = calculateOverlapDurationSeconds(patrolStart, patrolEnd, day1.from, day1.to);
      expect(day1Overlap).toBe(600);

      // Overlap with Day 2: 20:00 to 20:20 = 20 min (1200 sec)
      const day2Overlap = calculateOverlapDurationSeconds(patrolStart, patrolEnd, day2.from, day2.to);
      expect(day2Overlap).toBe(1200);

      // Exact sum: 600 + 1200 = 1800
      expect((day1Overlap ?? 0) + (day2Overlap ?? 0)).toBe(totalPatrolSeconds);
    });
  });
});

