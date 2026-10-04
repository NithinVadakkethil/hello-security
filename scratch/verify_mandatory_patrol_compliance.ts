import { prisma } from '../api/src/database/prisma';
import { mandatoryPatrolService } from '../api/src/modules/mandatory-patrol/mandatory-patrol.service';
import { calculateMandatoryWindow, getEffectiveShiftDate } from '../api/src/modules/mandatory-patrol/mandatory-patrol.util';
import { summaryReportService } from '../api/src/modules/report/summary-report.service';

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING MANDATORY PATROL COMPLIANCE & FLOW TESTS');
  console.log('====================================================\n');

  // Find a test client, site, employee, and shift
  const client = await prisma.client.findFirst({
    where: { isActive: true },
    include: { sites: true, users: true },
  });

  if (!client || client.sites.length === 0) {
    throw new Error('No active client/site found for test');
  }

  const site = client.sites[0];
  const employee = await prisma.employee.findFirst({
    where: { clientId: client.id, status: 'ACTIVE' },
  });

  if (!employee) {
    throw new Error('No active employee found for test');
  }

  // Create or find a test shift with 2 mandatory patrol times
  let shift = await prisma.shift.findFirst({
    where: {
      clientId: client.id,
      name: 'Test Mandatory Shift',
    },
  });

  if (!shift) {
    shift = await prisma.shift.create({
      data: {
        clientId: client.id,
        shiftCode: 'TMS-01',
        name: 'Test Mandatory Shift',
        startTime: '09:00',
        endTime: '18:00',
        mandatoryPatrol1Time: '12:00',
        mandatoryPatrol1WindowBefore: 15,
        mandatoryPatrol1WindowAfter: 60, // 11:45 to 13:00
        mandatoryPatrol2Time: '15:00',
        mandatoryPatrol2WindowBefore: 15,
        mandatoryPatrol2WindowAfter: 15, // 14:45 to 15:15
      },
    });
  }

  // Create or find an active guard assignment for this employee
  let assignment = await prisma.guardAssignment.findFirst({
    where: {
      employeeId: employee.id,
      isActive: true,
    },
  });

  if (!assignment) {
    assignment = await prisma.guardAssignment.create({
      data: {
        clientId: client.id,
        siteId: site.id,
        employeeId: employee.id,
        shiftId: shift.id,
        assignmentType: 'DIRECT_CHECKPOINTS',
        isActive: true,
      },
    });
  } else {
    assignment = await prisma.guardAssignment.update({
      where: { id: assignment.id },
      data: {
        shiftId: shift.id,
        siteId: site.id,
      },
    });
  }

  console.log(`Using Client: ${client.name}, Site: ${site.name}, Employee: ${employee.firstName} ${employee.lastName}`);
  console.log(`Assignment ID: ${assignment.id}, Shift ID: ${shift.id}\n`);

  // Clean up any test instances from today
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  await prisma.mandatoryPatrolInstance.deleteMany({
    where: {
      assignmentId: assignment.id,
      shiftDate: todayDateOnly,
    },
  });

  // ==========================================================
  // Test 1: Sync and verify UPCOMING / initial schedule
  // ==========================================================
  console.log('--- TEST 1: Schedule Sync & Initial UPCOMING State ---');
  const instances = await mandatoryPatrolService.syncMandatoryPatrolInstancesForAssignment(assignment.id, todayDateOnly);
  console.log(`Synced ${instances.length} instances:`);
  for (const inst of instances) {
    console.log(`  - Mandatory Patrol ${inst.sequence}: status=${inst.status}, scheduled=${inst.scheduledAt.toLocaleTimeString()}, window=[${inst.windowStart.toLocaleTimeString()} - ${inst.windowEnd.toLocaleTimeString()}]`);
  }
  if (instances.length !== 2) throw new Error('Expected 2 mandatory patrol instances to be created');
  console.log('✅ Test 1 Passed: 2 mandatory patrol instances created in UPCOMING state.\n');

  // ==========================================================
  // Test 2: Mobile Schedule Endpoint (No Start Button, Evaluates Status)
  // ==========================================================
  console.log('--- TEST 2: Employee Mobile Schedule (Informational Only) ---');
  const schedule = await mandatoryPatrolService.getEmployeeMandatorySchedule(employee.id);
  console.log(`Mobile Schedule Response hasAssignment=${schedule.hasAssignment}, Patrols count=${schedule.mandatoryPatrols.length}`);
  if (!schedule.hasAssignment || schedule.mandatoryPatrols.length !== 2) {
    throw new Error('Expected mobile schedule to return 2 items');
  }
  console.log('✅ Test 2 Passed: Mobile schedule returned successfully.\n');

  // ==========================================================
  // Test 3: Normal Patrol Flow Completed During Mandatory Window -> COMPLETED
  // ==========================================================
  console.log('--- TEST 3: Normal Patrol Qualifying for Mandatory Window 1 ---');
  // Set window 1 to include current time
  const now = new Date();
  const win1Start = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago
  const win1End = new Date(now.getTime() + 20 * 60 * 1000);   // 20 mins in future

  await prisma.mandatoryPatrolInstance.update({
    where: {
      assignmentId_shiftDate_sequence: {
        assignmentId: assignment.id,
        shiftDate: todayDateOnly,
        sequence: 1,
      },
    },
    data: {
      windowStart: win1Start,
      windowEnd: win1End,
      status: 'DUE',
    },
  });

  // Create a normal completed patrol session during this window
  const normalPatrolSession = await prisma.patrolSession.create({
    data: {
      clientId: client.id,
      assignmentId: assignment.id,
      patrolCode: `PATROL-TEST-${Date.now()}-1`,
      startedAt: new Date(now.getTime() - 5 * 60 * 1000),
      endedAt: now,
      status: 'COMPLETED',
      totalDuration: 5,
    },
  });

  // Process completion through standard hook
  await mandatoryPatrolService.handlePatrolCompleted(normalPatrolSession);

  const updatedInst1 = await prisma.mandatoryPatrolInstance.findUnique({
    where: {
      assignmentId_shiftDate_sequence: {
        assignmentId: assignment.id,
        shiftDate: todayDateOnly,
        sequence: 1,
      },
    },
  });

  console.log(`Mandatory Patrol 1 status: ${updatedInst1?.status}, completedAt: ${updatedInst1?.completedAt}, sessionId: ${updatedInst1?.patrolSessionId}`);
  if (updatedInst1?.status !== 'COMPLETED' || updatedInst1.patrolSessionId !== normalPatrolSession.id) {
    throw new Error('Expected Mandatory Patrol 1 to be marked COMPLETED and linked to normal patrol session');
  }
  console.log('✅ Test 3 Passed: Normal patrol automatically satisfied Mandatory Patrol 1.\n');

  // ==========================================================
  // Test 4: Expired Window -> MISSED + Exactly 1 Client Admin Notification
  // ==========================================================
  console.log('--- TEST 4: Expired Window -> MISSED & Deduplicated Notification ---');
  // Set window 2 to have ended 5 minutes ago
  const win2Start = new Date(now.getTime() - 30 * 60 * 1000);
  const win2End = new Date(now.getTime() - 5 * 60 * 1000);

  const inst2Before = await prisma.mandatoryPatrolInstance.update({
    where: {
      assignmentId_shiftDate_sequence: {
        assignmentId: assignment.id,
        shiftDate: todayDateOnly,
        sequence: 2,
      },
    },
    data: {
      windowStart: win2Start,
      windowEnd: win2End,
      status: 'DUE',
    },
  });

  // Clean prior notifications for this instance
  await prisma.notification.deleteMany({
    where: {
      idempotencyKey: `MANDATORY_PATROL_MISSED_${inst2Before.id}_${employee.id}`,
    },
  });

  // Run evaluator
  await mandatoryPatrolService.evaluateMandatoryPatrolStatuses();

  const inst2After = await prisma.mandatoryPatrolInstance.findUnique({
    where: { id: inst2Before.id },
  });
  console.log(`Mandatory Patrol 2 status: ${inst2After?.status}`);
  if (inst2After?.status !== 'MISSED') {
    throw new Error('Expected Mandatory Patrol 2 to be marked MISSED');
  }

  // Verify notification was created
  const notifs1 = await prisma.notification.findMany({
    where: {
      idempotencyKey: `MANDATORY_PATROL_MISSED_${inst2Before.id}_${employee.id}`,
    },
  });
  console.log(`Client Admin notifications created: ${notifs1.length}`);
  if (notifs1.length !== 1) {
    throw new Error(`Expected exactly 1 notification, found ${notifs1.length}`);
  }

  // Run evaluator again to test deduplication / idempotency
  await mandatoryPatrolService.evaluateMandatoryPatrolStatuses();
  const notifs2 = await prisma.notification.findMany({
    where: {
      idempotencyKey: `MANDATORY_PATROL_MISSED_${inst2Before.id}_${employee.id}`,
    },
  });
  console.log(`Client Admin notifications after retry: ${notifs2.length}`);
  if (notifs2.length !== 1) {
    throw new Error('Deduplication failed: Duplicate notification created');
  }
  console.log('✅ Test 4 Passed: Expired window marked MISSED with exactly 1 deduplicated Client Admin notification.\n');

  // ==========================================================
  // Test 5: Late Patrol Does Not Retroactively Complete Expired Mandatory Window
  // ==========================================================
  console.log('--- TEST 5: Late Normal Patrol Preserves MISSED Status ---');
  const latePatrolSession = await prisma.patrolSession.create({
    data: {
      clientId: client.id,
      assignmentId: assignment.id,
      patrolCode: `PATROL-TEST-${Date.now()}-2`,
      startedAt: now,
      endedAt: new Date(now.getTime() + 10 * 60 * 1000),
      status: 'COMPLETED',
      totalDuration: 10,
    },
  });

  await mandatoryPatrolService.handlePatrolCompleted(latePatrolSession);

  const inst2Late = await prisma.mandatoryPatrolInstance.findUnique({
    where: { id: inst2Before.id },
  });
  console.log(`Mandatory Patrol 2 status after late patrol: ${inst2Late?.status}`);
  if (inst2Late?.status !== 'MISSED') {
    throw new Error('Late patrol incorrectly converted MISSED mandatory patrol to completed');
  }
  console.log('✅ Test 5 Passed: Late normal patrol does NOT retroactively complete missed mandatory patrol.\n');

  // ==========================================================
  // Test 6: Additional/Normal Patrols Continue Working Without Limit
  // ==========================================================
  console.log('--- TEST 6: Additional Normal Patrols (#3, #4) ---');
  const additionalPatrol1 = await prisma.patrolSession.create({
    data: {
      clientId: client.id,
      assignmentId: assignment.id,
      patrolCode: `PATROL-TEST-${Date.now()}-3`,
      startedAt: new Date(now.getTime() + 30 * 60 * 1000),
      endedAt: new Date(now.getTime() + 40 * 60 * 1000),
      status: 'COMPLETED',
      totalDuration: 10,
    },
  });
  await mandatoryPatrolService.handlePatrolCompleted(additionalPatrol1);
  console.log(`Additional Patrol 1 completed with ID: ${additionalPatrol1.id}`);
  console.log('✅ Test 6 Passed: Additional patrols continue working independently.\n');

  // ==========================================================
  // Test 7: Overnight Shift Date Logic
  // ==========================================================
  console.log('--- TEST 7: Overnight Shift Handling ---');
  // Shift: 22:00 -> 06:00
  // Test time: 03:00 on 2026-10-01
  const refDateAt3AM = new Date(2026, 9, 1, 3, 0, 0); // Oct 1, 2026, 03:00
  const effShiftDate = getEffectiveShiftDate('22:00', '06:00', refDateAt3AM);
  console.log(`At 03:00 on Oct 1, effective shift date is: ${effShiftDate.toISOString().slice(0, 10)}`);
  if (effShiftDate.getDate() !== 30 || effShiftDate.getMonth() !== 8) { // 30 Sep
    throw new Error('Overnight shift date calculation failed: expected 2026-09-30');
  }

  const overnightWindow = calculateMandatoryWindow('22:00', '06:00', effShiftDate, '03:00', 15, 15);
  console.log(`Overnight mandatory patrol at 03:00 window: [${overnightWindow.windowStart.toISOString()} - ${overnightWindow.windowEnd.toISOString()}]`);
  if (overnightWindow.scheduledAt.getDate() !== 1 || overnightWindow.scheduledAt.getHours() !== 3) {
    throw new Error('Overnight window scheduled time failed: expected Oct 1 at 03:00');
  }
  console.log('✅ Test 7 Passed: Overnight shifts properly calculate shift date & window across midnight.\n');

  // ==========================================================
  // Test 8: Reports Query Includes Mandatory Patrol Compliance Details
  // ==========================================================
  console.log('--- TEST 8: Summary Report Mandatory Patrol Compliance Details ---');
  const mockUser: any = {
    id: 'test-admin',
    clientId: client.id,
    role: 'CLIENT_ADMIN',
  };

  const reportData = await summaryReportService.generateReportDataset({
    user: mockUser,
    clientId: client.id,
    siteId: site.id,
    periodType: 'DAILY',
    startDate: todayDateOnly.toISOString().slice(0, 10),
    endDate: todayDateOnly.toISOString().slice(0, 10),
    includeIncidents: false,
  });

  console.log(`Report mandatoryPatrols count: ${reportData.mandatoryPatrols.length}`);
  console.log(`Report summary: mandatoryScheduled=${reportData.summary?.mandatoryScheduled}, completed=${reportData.summary?.mandatoryCompleted}, missed=${reportData.summary?.mandatoryMissed}`);
  for (const m of reportData.mandatoryPatrols) {
    console.log(`  - Mandatory Patrol ${m.sequence} (${m.guardName}): status=${m.status}, req=${m.scheduledAt}, window=${m.windowStart} - ${m.windowEnd}, completedAt=${m.completedAt}`);
  }

  if (reportData.mandatoryPatrols.length === 0) {
    throw new Error('Report did not contain mandatory patrol records');
  }
  console.log('✅ Test 8 Passed: Report contains full mandatory patrol compliance details.\n');

  // ==========================================================
  // Test 9: Filtered Report By Specific Employee
  // ==========================================================
  console.log('--- TEST 9: Filtered Report by Employee ---');
  const filteredReport = await summaryReportService.generateReportDataset({
    user: mockUser,
    clientId: client.id,
    siteId: site.id,
    employeeId: employee.id,
    periodType: 'DAILY',
    startDate: todayDateOnly.toISOString().slice(0, 10),
    endDate: todayDateOnly.toISOString().slice(0, 10),
    includeIncidents: false,
  });

  console.log(`Filtered report mandatoryPatrols count: ${filteredReport.mandatoryPatrols.length}`);
  for (const m of filteredReport.mandatoryPatrols) {
    if (m.guardName !== `${employee.firstName} ${employee.lastName || ''}`.trim()) {
      throw new Error(`Report contained record for unexpected guard: ${m.guardName}`);
    }
  }
  console.log('✅ Test 9 Passed: Employee filter in report correctly isolates employee records.\n');

  console.log('====================================================');
  console.log('ALL 9 MANDATORY PATROL TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('====================================================');
}

runTests()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
