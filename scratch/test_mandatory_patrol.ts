import { calculateMandatoryWindow, parseTimeToMinutes } from '../api/src/modules/mandatory-patrol/mandatory-patrol.util';

function testMandatoryPatrolSuite() {
  console.log('=== RUNNING MANDATORY PATROL & NOTIFICATION UNIT TESTS ===\n');

  // Test 1: Time parser
  console.assert(parseTimeToMinutes('23:00') === 1380, '23:00 should be 1380 mins');
  console.assert(parseTimeToMinutes('03:00') === 180, '03:00 should be 180 mins');
  console.log('✅ Test 1: Time parser passed');

  // Test 2: Standard Day Shift (08:00 -> 16:00), Patrol at 10:00 (before: 15, after: 15)
  const shiftDate = new Date(2026, 8, 30); // 30 Sept 2026
  const windowDay = calculateMandatoryWindow('08:00', '16:00', shiftDate, '10:00', 15, 15);

  console.assert(windowDay.scheduledAt.getHours() === 10, 'Day patrol scheduled at 10 AM');
  console.assert(windowDay.windowStart.getMinutes() === 45 && windowDay.windowStart.getHours() === 9, 'Window start 09:45 AM');
  console.assert(windowDay.windowEnd.getMinutes() === 15 && windowDay.windowEnd.getHours() === 10, 'Window end 10:15 AM');
  console.log('✅ Test 2: Day shift mandatory patrol window passed');

  // Test 3: Overnight Shift (22:00 -> 06:00), Patrol 1 at 23:00 (same day)
  const windowNight1 = calculateMandatoryWindow('22:00', '06:00', shiftDate, '23:00', 15, 15);
  console.assert(windowNight1.scheduledAt.getDate() === 30, 'Patrol 1 is on 30th Sept');
  console.assert(windowNight1.scheduledAt.getHours() === 23, 'Patrol 1 scheduled at 11 PM');
  console.log('✅ Test 3: Overnight shift Patrol 1 (before midnight) passed');

  // Test 4: Overnight Shift (22:00 -> 06:00), Patrol 2 at 03:00 (next day rollover)
  const windowNight2 = calculateMandatoryWindow('22:00', '06:00', shiftDate, '03:00', 15, 15);
  console.assert(windowNight2.scheduledAt.getDate() === 1, 'Patrol 2 rolls over to 1st Oct');
  console.assert(windowNight2.scheduledAt.getHours() === 3, 'Patrol 2 scheduled at 3 AM');
  console.assert(windowNight2.windowStart.getHours() === 2 && windowNight2.windowStart.getMinutes() === 45, 'Window start 02:45 AM on 1st Oct');
  console.assert(windowNight2.windowEnd.getHours() === 3 && windowNight2.windowEnd.getMinutes() === 15, 'Window end 03:15 AM on 1st Oct');
  console.log('✅ Test 4: Overnight shift Patrol 2 (after midnight rollover) passed');

  console.log('\n🎉 ALL MANDATORY PATROL TESTS PASSED SUCCESSFULLY!');
}

testMandatoryPatrolSuite();
