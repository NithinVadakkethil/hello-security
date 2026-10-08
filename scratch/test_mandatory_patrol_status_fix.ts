import { prisma } from '../api/src/database/prisma';
import { mandatoryPatrolService } from '../api/src/modules/mandatory-patrol/mandatory-patrol.service';
import { calculateMandatoryWindow, getEffectiveShiftDate } from '../api/src/modules/mandatory-patrol/mandatory-patrol.util';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

async function runTests() {
  console.log('=== TEST SUITE: MANDATORY PATROL 2 UPCOMING VS MISSED STATUS ===\n');

  // Find or create test client, site, shift, employee, assignment
  const client = await prisma.client.findFirst({ where: { isActive: true } });
  if (!client) {
    console.error('No client found');
    return;
  }

  const site = await prisma.site.findFirst({ where: { clientId: client.id, isActive: true } });
  const employee = await prisma.employee.findFirst({ where: { clientId: client.id, status: 'ACTIVE' } });
  if (!site || !employee) {
    console.error('Site or Employee not found');
    return;
  }

  // Create or find a test shift matching the user scenario: 10:00 - 20:00, MP1: 12:30, MP2: 14:00
  const timestamp = Date.now();
  const testShift = await prisma.shift.create({
    data: {
      clientId: client.id,
      shiftCode: `TEST-SHIFT-${timestamp}`,
      name: `Test Day Shift ${timestamp}`,
      startTime: '10:00',
      endTime: '20:00',
      mandatoryPatrol1Time: '12:30',
      mandatoryPatrol1WindowBefore: 15,
      mandatoryPatrol1WindowAfter: 15,
      mandatoryPatrol2Time: '14:00',
      mandatoryPatrol2WindowBefore: 15,
      mandatoryPatrol2WindowAfter: 15,
    },
  });

  const testAssignment = await prisma.guardAssignment.create({
    data: {
      clientId: client.id,
      siteId: site.id,
      employeeId: employee.id,
      shiftId: testShift.id,
      isActive: true,
      effectiveFrom: new Date(),
    },
  });

  try {
    const today = getEffectiveShiftDate(testShift.startTime, testShift.endTime, new Date());
    console.log('Syncing instances for test assignment...');
    const instances = await mandatoryPatrolService.syncMandatoryPatrolInstancesForAssignment(testAssignment.id, today);

    assert(instances.length === 2, 'Created 2 mandatory patrol instances for shift');

    const inst1 = instances.find((i) => i.sequence === 1)!;
    const inst2 = instances.find((i) => i.sequence === 2)!;

    console.log(`Inst 1 (12:30): Window ${inst1.windowStart.toISOString()} - ${inst1.windowEnd.toISOString()}, Status: ${inst1.status}`);
    console.log(`Inst 2 (14:00): Window ${inst2.windowStart.toISOString()} - ${inst2.windowEnd.toISOString()}, Status: ${inst2.status}`);

    // If current time is before 13:45 (e.g. 12:22), inst2 MUST be UPCOMING, NOT MISSED!
    const now = new Date();
    if (now < inst2.windowStart) {
      assert(inst2.status === 'UPCOMING', `Mandatory Patrol 2 status is "UPCOMING" when current time is before windowStart (got "${inst2.status}")`);
    }

    // Now test scenario: simulate inst2 was previously marked MISSED (e.g. before shift update)
    await prisma.mandatoryPatrolInstance.update({
      where: { id: inst2.id },
      data: { status: 'MISSED' },
    });
    console.log('\nSimulated inst2 was stuck with status "MISSED" in DB.');

    // Run sync again as happens when guard opens app or evaluator runs
    const syncedAgain = await mandatoryPatrolService.syncMandatoryPatrolInstancesForAssignment(testAssignment.id, today);
    const inst2AfterSync = syncedAgain.find((i) => i.sequence === 2)!;

    if (now < inst2.windowStart) {
      assert(inst2AfterSync.status === 'UPCOMING', `After sync/evaluator, future patrol status was successfully recovered to "UPCOMING" (got "${inst2AfterSync.status}")`);
    }

    // Test evaluateMandatoryPatrolStatuses background runner
    await mandatoryPatrolService.evaluateMandatoryPatrolStatuses();
    const inst2AfterEval = await prisma.mandatoryPatrolInstance.findUnique({ where: { id: inst2.id } });

    if (now < inst2.windowStart) {
      assert(inst2AfterEval?.status === 'UPCOMING', `Background evaluator keeps future patrol as "UPCOMING" (got "${inst2AfterEval?.status}")`);
    }

    // Test getEmployeeMandatorySchedule endpoint for mobile app
    const mobileSchedule = await mandatoryPatrolService.getEmployeeMandatorySchedule(employee.id);
    const mobileInst2 = mobileSchedule.mandatoryPatrols.find((p) => p.sequence === 2);
    if (now < inst2.windowStart) {
      assert(mobileInst2?.status === 'UPCOMING', `Mobile API endpoint returns "UPCOMING" for Mandatory Patrol 2 (got "${mobileInst2?.status}")`);
    }

    console.log('\n🎉 ALL MANDATORY PATROL STATUS TRANSITION TESTS PASSED!');
  } finally {
    // Cleanup test data
    await prisma.mandatoryPatrolInstance.deleteMany({ where: { assignmentId: testAssignment.id } });
    await prisma.guardAssignment.delete({ where: { id: testAssignment.id } });
    await prisma.shift.delete({ where: { id: testShift.id } });
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
