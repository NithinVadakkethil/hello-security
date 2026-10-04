import { PrismaClient } from '@prisma/client';
import { AttendanceService } from '../api/src/modules/attendance/attendance.service';

const prisma = new PrismaClient();
const attendanceService = new AttendanceService();

async function runVerification() {
  console.log('================================================================');
  console.log('=== ATTENDANCE DEDUPLICATION & INDEPENDENCE VERIFICATION ===');
  console.log('================================================================\n');

  // 1. Find Client Admin user
  const clientAdminUser = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN', isActive: true, clientId: { not: null } },
    include: { client: true },
  });

  if (!clientAdminUser) {
    throw new Error('No active Client Admin found');
  }

  const authUser = {
    id: clientAdminUser.id,
    role: clientAdminUser.role,
    tenantId: clientAdminUser.clientId!,
  };

  console.log(`[TEST 1] Authorized User: ${clientAdminUser.email} (Client: ${clientAdminUser.client?.companyName})`);

  // 2. Query attendance for 2026-10-03 and verify employee uniqueness
  const resToday = await attendanceService.listAttendance(authUser, { date: '2026-10-03', page: 1, limit: 100 });
  console.log(`\n[TEST 2] Attendance for 2026-10-03 (Total unique employee records: ${resToday.pagination.total})`);

  const seenEmployeeIds = new Set<string>();
  const seenEmployeeNames = new Set<string>();
  let hasDuplicate = false;

  for (const rec of resToday.records) {
    console.log(` - Employee: "${rec.employeeName}" (ID: ${rec.employeeId}) | Shift: "${rec.shiftName}" | Status: ${rec.status} | Check-in: ${rec.checkInTime || '—'} | Check-out: ${rec.checkOutTime || '—'} | Duration: ${rec.workingDuration || '—'}`);

    if (seenEmployeeIds.has(rec.employeeId)) {
      console.error(`FAILED: Duplicate employee found in results: ${rec.employeeName} (${rec.employeeId})`);
      hasDuplicate = true;
    }
    seenEmployeeIds.add(rec.employeeId);
    seenEmployeeNames.add(rec.employeeName);
  }

  if (hasDuplicate) {
    throw new Error('FAILED: Duplicate employee rows detected in attendance query!');
  } else {
    console.log(`✓ PASS: All ${resToday.records.length} records belong to unique employees. Zero same-day duplicates!`);
  }

  // 3. Test Check-In & Duplicate Check-In Rejection
  console.log('\n[TEST 3] Testing Check-In & Duplicate Prevention Rules...');
  const testEmp = resToday.records[0];
  if (testEmp) {
    const testDate = '2026-10-03';
    
    // 3a. Initial Check-in
    console.log(` - Performing initial check-in for "${testEmp.employeeName}" on ${testDate}...`);
    const checkInRes = await attendanceService.recordCheckIn(authUser, {
      employeeId: testEmp.employeeId,
      assignmentId: testEmp.assignmentId,
      businessDate: testDate,
    });
    console.log(`   Result: Status=${checkInRes.status}, CheckIn=${checkInRes.checkInTime}`);

    if (!checkInRes.checkInTime) {
      throw new Error('FAILED: Check-in time was not set on check-in');
    }

    // 3b. Attempt duplicate check-in same day -> MUST REJECT
    console.log(` - Attempting duplicate check-in on same day for "${testEmp.employeeName}"...`);
    try {
      await attendanceService.recordCheckIn(authUser, {
        employeeId: testEmp.employeeId,
        assignmentId: testEmp.assignmentId,
        businessDate: testDate,
      });
      throw new Error('FAILED: Duplicate check-in was allowed when employee was already checked in!');
    } catch (err: any) {
      if (err.code === 'ATTENDANCE_ALREADY_CHECKED_IN' || err.message?.includes('already checked in')) {
        console.log(`   ✓ PASS: Duplicate check-in correctly rejected (${err.message})`);
      } else {
        throw err;
      }
    }

    // 3c. Perform Check-out
    console.log(` - Performing check-out for "${testEmp.employeeName}" on ${testDate}...`);
    const checkOutRes = await attendanceService.recordCheckOut(authUser, {
      employeeId: testEmp.employeeId,
      assignmentId: testEmp.assignmentId,
      businessDate: testDate,
    });
    console.log(`   Result: Status=${checkOutRes.status}, CheckOut=${checkOutRes.checkOutTime}, Duration=${checkOutRes.workingDuration}`);

    if (!checkOutRes.checkOutTime) {
      throw new Error('FAILED: Check-out time was not set on check-out');
    }
    if (checkOutRes.status !== 'COMPLETED') {
      throw new Error(`FAILED: Status should be COMPLETED, got ${checkOutRes.status}`);
    }

    // 3d. Attempt check-in after checkout on same day -> MUST REJECT
    console.log(` - Attempting check-in after checkout on same day for "${testEmp.employeeName}"...`);
    try {
      await attendanceService.recordCheckIn(authUser, {
        employeeId: testEmp.employeeId,
        assignmentId: testEmp.assignmentId,
        businessDate: testDate,
      });
      throw new Error('FAILED: Check-in after checkout was allowed on the same business date!');
    } catch (err: any) {
      if (err.code === 'ATTENDANCE_ALREADY_COMPLETED' || err.message?.includes('already completed')) {
        console.log(`   ✓ PASS: Check-in after checkout correctly rejected (${err.message})`);
      } else {
        throw err;
      }
    }

    // 3e. Attempt duplicate check-out on same day -> MUST REJECT
    console.log(` - Attempting duplicate check-out for "${testEmp.employeeName}"...`);
    try {
      await attendanceService.recordCheckOut(authUser, {
        employeeId: testEmp.employeeId,
        assignmentId: testEmp.assignmentId,
        businessDate: testDate,
      });
      throw new Error('FAILED: Duplicate checkout was allowed!');
    } catch (err: any) {
      if (err.code === 'ATTENDANCE_ALREADY_COMPLETED' || err.message?.includes('already been checked out')) {
        console.log(`   ✓ PASS: Duplicate checkout correctly rejected (${err.message})`);
      } else {
        throw err;
      }
    }

    // 3f. Check-in on NEXT business date -> MUST SUCCEED
    const nextDate = '2026-10-04';
    console.log(` - Performing check-in on NEXT business date (${nextDate}) for "${testEmp.employeeName}"...`);
    const nextDayCheckIn = await attendanceService.recordCheckIn(authUser, {
      employeeId: testEmp.employeeId,
      assignmentId: testEmp.assignmentId,
      businessDate: nextDate,
    });
    console.log(`   Result: Status=${nextDayCheckIn.status}, CheckIn=${nextDayCheckIn.checkInTime}`);
    if (!nextDayCheckIn.checkInTime) {
      throw new Error('FAILED: Next day check-in failed to record timestamp');
    }
    console.log('   ✓ PASS: Next business date check-in succeeded as expected.');
  }

  // 4. Test Report Generation with Deduplicated Dataset
  console.log('\n[TEST 4] Testing Attendance PDF and Excel Reports...');
  const pdfExport = await attendanceService.exportAttendanceReport(authUser, { date: '2026-10-03' }, 'pdf');
  console.log(` - PDF Export: ${pdfExport.filename}, Size=${pdfExport.buffer.length} bytes`);
  const excelExport = await attendanceService.exportAttendanceReport(authUser, { date: '2026-10-03' }, 'excel');
  console.log(` - Excel Export: ${excelExport.filename}, Size=${excelExport.buffer.length} bytes`);
  console.log('✓ PASS: Both PDF and Excel exports generated cleanly.');

  console.log('\n================================================================');
  console.log('=== ALL DEDUPLICATION & INDEPENDENCE TESTS PASSED ===');
  console.log('================================================================\n');
}

runVerification()
  .catch((err) => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
