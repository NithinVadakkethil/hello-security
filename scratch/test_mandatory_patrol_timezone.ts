import { calculateMandatoryWindow, getEffectiveShiftDate } from '../api/src/modules/mandatory-patrol/mandatory-patrol.util';
import {
  createDateInTimezone,
  getDateComponentsInTimezone,
  formatPatrolDate,
  formatPatrolTime,
  formatPatrolDateTime,
  DEFAULT_TIMEZONE,
} from '../api/src/common/utils/date-formatter.util';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

console.log('=== TEST MATRIX: MANDATORY PATROL TIMEZONE HANDLING ===\n');

// 1. India Test
console.log('--- Scenario 1: India Shift (Asia/Kolkata) ---');
const indiaTz = 'Asia/Kolkata';
const indiaShiftDate = '2026-10-05';
const indiaWindow = calculateMandatoryWindow(
  '09:00',
  '18:00',
  indiaShiftDate,
  '11:00',
  15,
  15,
  indiaTz,
);

const indiaFormattedTime = formatPatrolTime(indiaWindow.scheduledAt, indiaTz, false);
const indiaFormattedStart = formatPatrolTime(indiaWindow.windowStart, indiaTz, false);
const indiaFormattedEnd = formatPatrolTime(indiaWindow.windowEnd, indiaTz, false);

console.log(`Scheduled: ${indiaFormattedTime}, Window: ${indiaFormattedStart} - ${indiaFormattedEnd}`);
assert(indiaFormattedTime === '11:00 AM', `India scheduled time is 11:00 AM (got ${indiaFormattedTime})`);
assert(indiaFormattedStart === '10:45 AM', `India window start is 10:45 AM (got ${indiaFormattedStart})`);
assert(indiaFormattedEnd === '11:15 AM', `India window end is 11:15 AM (got ${indiaFormattedEnd})`);

// 2. UAE Test
console.log('\n--- Scenario 2: UAE Shift (Asia/Dubai) ---');
const uaeTz = 'Asia/Dubai';
const uaeShiftDate = '2026-10-05';
const uaeWindow = calculateMandatoryWindow(
  '08:00',
  '20:00',
  uaeShiftDate,
  '14:30',
  15,
  15,
  uaeTz,
);

const uaeFormattedTime = formatPatrolTime(uaeWindow.scheduledAt, uaeTz, false);
const uaeFormattedStart = formatPatrolTime(uaeWindow.windowStart, uaeTz, false);
const uaeFormattedEnd = formatPatrolTime(uaeWindow.windowEnd, uaeTz, false);

console.log(`Scheduled: ${uaeFormattedTime}, Window: ${uaeFormattedStart} - ${uaeFormattedEnd}`);
assert(uaeFormattedTime === '2:30 PM', `UAE scheduled time is 2:30 PM (got ${uaeFormattedTime})`);
assert(uaeFormattedStart === '2:15 PM', `UAE window start is 2:15 PM (got ${uaeFormattedStart})`);
assert(uaeFormattedEnd === '2:45 PM', `UAE window end is 2:45 PM (got ${uaeFormattedEnd})`);

// 3. Cross-Location Viewing Test
console.log('\n--- Scenario 3: Cross-Location Viewing (UAE Shift viewed/edited) ---');
// When viewing UAE shift from any client, using shift/business timezone 'Asia/Dubai' preserves 14:30 -> 14:45
const crossLocationTime = formatPatrolTime(uaeWindow.scheduledAt, 'Asia/Dubai', false);
const crossLocationStart = formatPatrolTime(uaeWindow.windowStart, 'Asia/Dubai', false);
const crossLocationEnd = formatPatrolTime(uaeWindow.windowEnd, 'Asia/Dubai', false);
assert(crossLocationTime === '2:30 PM', `Cross-location scheduled time is preserved as 2:30 PM`);
assert(crossLocationStart === '2:15 PM', `Cross-location window start is preserved as 2:15 PM`);
assert(crossLocationEnd === '2:45 PM', `Cross-location window end is preserved as 2:45 PM`);

// 4. Overnight Shift Test
console.log('\n--- Scenario 4: Overnight Shift (20:00 -> 08:00) ---');
const overnightShiftDate = '2026-10-05';
const overnightWindow1 = calculateMandatoryWindow(
  '20:00',
  '08:00',
  overnightShiftDate,
  '23:30',
  15,
  15,
  uaeTz,
);
const overnightWindow2 = calculateMandatoryWindow(
  '20:00',
  '08:00',
  overnightShiftDate,
  '03:00',
  15,
  15,
  uaeTz,
);

const w1Time = formatPatrolTime(overnightWindow1.scheduledAt, uaeTz, false);
const w1Date = formatPatrolDate(overnightWindow1.scheduledAt, uaeTz);
const w2Time = formatPatrolTime(overnightWindow2.scheduledAt, uaeTz, false);
const w2Date = formatPatrolDate(overnightWindow2.scheduledAt, uaeTz);

console.log(`Window 1 (23:30): ${w1Date} ${w1Time}`);
console.log(`Window 2 (03:00): ${w2Date} ${w2Time}`);

assert(w1Time === '11:30 PM', `Overnight Window 1 time is 11:30 PM`);
assert(w1Date === '5 Oct 2026', `Overnight Window 1 is on base date 5 Oct 2026`);
assert(w2Time === '3:00 AM', `Overnight Window 2 time is 3:00 AM`);
assert(w2Date === '6 Oct 2026', `Overnight Window 2 correctly advanced to 6 Oct 2026 (next day)`);

// 5. Effective Shift Date for Overnight Shifts
console.log('\n--- Scenario 5: Effective Shift Date Calculation ---');
// At 02:00 AM on Oct 6 (UAE time), the effective shift date for a 20:00->08:00 shift is Oct 5.
const earlyMorningOct6 = createDateInTimezone(2026, 10, 6, 2, 0, 0, uaeTz);
const effDate = getEffectiveShiftDate('20:00', '08:00', earlyMorningOct6, uaeTz);
const effDateParts = getDateComponentsInTimezone(effDate, 'UTC');
console.log(`At 02:00 AM on Oct 6, effective shift date is: ${effDateParts.year}-${effDateParts.month}-${effDateParts.day}`);
assert(effDateParts.year === 2026 && effDateParts.month === 10 && effDateParts.day === 5, 'Effective shift date correctly maps back to Oct 5');

// 6. Reports and Notification Formatting
console.log('\n--- Scenario 6: Reports and Notification Formatting ---');
const reportFormatted = formatPatrolDateTime(uaeWindow.scheduledAt, uaeTz, false);
console.log(`Report formatting: ${reportFormatted}`);
assert(reportFormatted === '5 Oct 2026, 2:30 PM', `Report format matches expected '5 Oct 2026, 2:30 PM'`);

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
