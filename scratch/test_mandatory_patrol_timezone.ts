import { calculateMandatoryWindow, getEffectiveShiftDate } from './api/src/modules/mandatory-patrol/mandatory-patrol.util';
import { formatPatrolDate, formatPatrolTime, formatPatrolDateTime, createDateInTimezone, getDateComponentsInTimezone, DEFAULT_TIMEZONE } from './api/src/common/utils/date-formatter.util';

console.log('=== TEST 1: Timezone date creation & extraction ===');
const tzUAE = 'Asia/Dubai';
const tzIndia = 'Asia/Kolkata';

// Create a date representing 2026-10-07 11:00:00 in Asia/Dubai
const uaeDate = createDateInTimezone(2026, 10, 7, 11, 0, 0, tzUAE);
console.log('UAE Date ISO (UTC):', uaeDate.toISOString()); // Should be 07:00:00 UTC (Dubai is UTC+4)
console.log('UAE formatted in Dubai:', formatPatrolTime(uaeDate, tzUAE, false)); // 11:00 AM
console.log('UAE formatted in India:', formatPatrolTime(uaeDate, tzIndia, false)); // 12:30 PM (India is UTC+5:30)

// Create a date representing 2026-10-07 11:00:00 in Asia/Kolkata
const indDate = createDateInTimezone(2026, 10, 7, 11, 0, 0, tzIndia);
console.log('India Date ISO (UTC):', indDate.toISOString()); // Should be 05:30:00 UTC
console.log('India formatted in India:', formatPatrolTime(indDate, tzIndia, false)); // 11:00 AM
console.log('India formatted in Dubai:', formatPatrolTime(indDate, tzUAE, false)); // 9:30 AM

console.log('\n=== TEST 2: Daytime UAE Shift (08:00 - 20:00, MP at 11:00) ===');
const baseShiftDateUAE = new Date(Date.UTC(2026, 9, 7)); // Oct 7, 2026
const windowUAE = calculateMandatoryWindow(baseShiftDateUAE, '08:00', '11:00', 15, tzUAE);
console.log('ScheduledAt ISO:', windowUAE.scheduledAt.toISOString());
console.log('WindowStart ISO:', windowUAE.windowStart.toISOString());
console.log('WindowEnd ISO:', windowUAE.windowEnd.toISOString());
console.log('Formatted ScheduledAt in Dubai:', formatPatrolTime(windowUAE.scheduledAt, tzUAE, false)); // Must be 11:00 AM
console.log('Formatted WindowStart in Dubai:', formatPatrolTime(windowUAE.windowStart, tzUAE, false)); // Must be 11:00 AM
console.log('Formatted WindowEnd in Dubai:', formatPatrolTime(windowUAE.windowEnd, tzUAE, false)); // Must be 11:15 AM
console.log('Summary report format:', formatPatrolDateTime(windowUAE.scheduledAt, tzUAE, false)); // 7 Oct 2026, 11:00 AM

console.log('\n=== TEST 3: Overnight UAE Shift (20:00 - 08:00, MP1 at 23:30, MP2 at 03:00 next day) ===');
const windowMP1 = calculateMandatoryWindow(baseShiftDateUAE, '20:00', '23:30', 15, tzUAE);
const windowMP2 = calculateMandatoryWindow(baseShiftDateUAE, '20:00', '03:00', 15, tzUAE);

console.log('MP1 ScheduledAt in Dubai:', formatPatrolDateTime(windowMP1.scheduledAt, tzUAE, false)); // 7 Oct 2026, 11:30 PM
console.log('MP1 Window in Dubai:', `${formatPatrolTime(windowMP1.windowStart, tzUAE, false)} - ${formatPatrolTime(windowMP1.windowEnd, tzUAE, false)}`); // 11:30 PM - 11:45 PM

console.log('MP2 ScheduledAt in Dubai:', formatPatrolDateTime(windowMP2.scheduledAt, tzUAE, false)); // 8 Oct 2026, 3:00 AM
console.log('MP2 Window in Dubai:', `${formatPatrolTime(windowMP2.windowStart, tzUAE, false)} - ${formatPatrolTime(windowMP2.windowEnd, tzUAE, false)}`); // 3:00 AM - 3:15 AM
console.log('MP2 Scheduled Date Components in Dubai:', getDateComponentsInTimezone(windowMP2.scheduledAt, tzUAE));

console.log('\n=== TEST 4: getEffectiveShiftDate for Overnight Shift ===');
// At 23:30 Dubai time on Oct 7
const now2330 = createDateInTimezone(2026, 10, 7, 23, 30, 0, tzUAE);
const effDate2330 = getEffectiveShiftDate(now2330, '20:00', '08:00', tzUAE);
console.log('At 23:30 on Oct 7 -> Effective Shift Date:', effDate2330.toISOString()); // 2026-10-07T00:00:00.000Z

// At 03:10 Dubai time on Oct 8 (post-midnight)
const now0310 = createDateInTimezone(2026, 10, 8, 3, 10, 0, tzUAE);
const effDate0310 = getEffectiveShiftDate(now0310, '20:00', '08:00', tzUAE);
console.log('At 03:10 on Oct 8 -> Effective Shift Date:', effDate0310.toISOString()); // 2026-10-07T00:00:00.000Z (Must belong to shift started Oct 7)

console.log('\n=== ALL TIMEZONE TESTS COMPLETED ===');
