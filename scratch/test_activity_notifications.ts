import { prisma } from '../api/src/database/prisma';
import { notificationService } from '../api/src/modules/notification/notification.service';
import { attendanceService } from '../api/src/modules/attendance/attendance.service';
import { patrolSessionService } from '../api/src/modules/patrol-session/patrol-session.service';
import { mandatoryPatrolService } from '../api/src/modules/mandatory-patrol/mandatory-patrol.service';

async function runTests() {
  console.log('🧪 Starting Employee Activity Notification Tests...');

  // 1. Fetch test client, admin, manager, employee
  const client = await prisma.client.findFirst({
    where: { isActive: true },
    include: {
      users: { where: { role: 'CLIENT_ADMIN', isActive: true } },
      employees: {
        where: { status: 'ACTIVE', assignments: { some: { isActive: true } } },
        include: { assignments: { where: { isActive: true }, include: { site: true, shift: true, patrolRoute: true } } },
      },
    },
  });

  if (!client || !client.employees.length) {
    console.error('❌ No suitable test client or employee found');
    process.exit(1);
  }

  const employee = client.employees[0];
  const assignment = employee.assignments[0];
  const clientAdminUser = client.users[0] || { id: 'test-admin', role: 'CLIENT_ADMIN', tenantId: client.id };

  console.log(`📌 Using Client: ${client.companyName} (${client.id})`);
  console.log(`📌 Using Employee: ${employee.firstName} ${employee.lastName || ''} (${employee.id})`);
  console.log(`📌 Using Assignment: ${assignment.id} (Site: ${assignment.site?.name})`);

  // Test 1: Attendance Check-In Notification
  console.log('\n--- Test 1: Attendance Check-In Notification ---');
  const testBusinessDate = '2099-12-31'; // Future date for clean isolated testing
  // Clean up any test attendance on this date
  await prisma.attendance.deleteMany({
    where: { employeeId: employee.id, attendanceDate: new Date('2099-12-31T00:00:00.000Z') },
  });

  const checkInRes = await attendanceService.recordCheckIn(
    { id: clientAdminUser.id, role: 'CLIENT_ADMIN', tenantId: client.id },
    { employeeId: employee.id, assignmentId: assignment.id, businessDate: testBusinessDate },
  );

  console.log('Recorded Check-In ID:', checkInRes.id);

  // Verify notification was created
  const checkInNotif = await prisma.notification.findUnique({
    where: { idempotencyKey: `EMPLOYEE_CHECKED_IN_${checkInRes.id}` },
    include: { recipients: true },
  });

  if (!checkInNotif || checkInNotif.type !== 'EMPLOYEE_CHECKED_IN') {
    throw new Error('❌ Test 1 Failed: EMPLOYEE_CHECKED_IN notification not found!');
  }
  console.log('✅ Test 1 Passed: EMPLOYEE_CHECKED_IN notification created with title:', checkInNotif.title, 'message:', checkInNotif.message);
  console.log('   Recipients count:', checkInNotif.recipients.length);

  // Test 2: Attendance Check-Out Notification
  console.log('\n--- Test 2: Attendance Check-Out Notification ---');
  const checkOutRes = await attendanceService.recordCheckOut(
    { id: clientAdminUser.id, role: 'CLIENT_ADMIN', tenantId: client.id },
    { employeeId: employee.id, assignmentId: assignment.id, businessDate: testBusinessDate },
  );

  const checkOutNotif = await prisma.notification.findUnique({
    where: { idempotencyKey: `EMPLOYEE_CHECKED_OUT_${checkOutRes.id}` },
    include: { recipients: true },
  });

  if (!checkOutNotif || checkOutNotif.type !== 'EMPLOYEE_CHECKED_OUT') {
    throw new Error('❌ Test 2 Failed: EMPLOYEE_CHECKED_OUT notification not found!');
  }
  console.log('✅ Test 2 Passed: EMPLOYEE_CHECKED_OUT notification created with title:', checkOutNotif.title, 'message:', checkOutNotif.message);
  console.log('   Metadata workingDuration:', (checkOutNotif.metadata as any)?.workingDuration);

  // Clean up test attendance
  await prisma.attendance.deleteMany({
    where: { employeeId: employee.id, attendanceDate: new Date('2099-12-31T00:00:00.000Z') },
  });

  const gate = await prisma.gate.findFirst({
    where: { siteId: assignment.siteId },
  });

  // Test 3: Normal Patrol Completion Notification
  console.log('\n--- Test 3: Normal Patrol Completion Notification ---');
  // Create a patrol session with a scanned checkpoint
  const normalPatrol = await patrolSessionService.start(
    client.id,
    employee.id,
    assignment.id,
    false,
  );

  if (gate) {
    await prisma.patrolCheckpoint.create({
      data: {
        patrolSessionId: normalPatrol.id,
        gateId: gate.id,
        status: 'SCANNED',
        scannedAt: new Date(),
      },
    });
  }

  // Complete the patrol
  await patrolSessionService.complete(normalPatrol.id, 'Test normal patrol completed');

  // Verify PATROL_COMPLETED notification
  const normalNotif = await prisma.notification.findUnique({
    where: { idempotencyKey: `PATROL_COMPLETED_${normalPatrol.id}` },
    include: { recipients: true },
  });

  if (!normalNotif || normalNotif.type !== 'PATROL_COMPLETED') {
    throw new Error('❌ Test 3 Failed: PATROL_COMPLETED notification not found!');
  }
  console.log('✅ Test 3 Passed: PATROL_COMPLETED notification created with title:', normalNotif.title, 'message:', normalNotif.message);

  // Test 4: Multiple Normal Patrols generate multiple notifications
  console.log('\n--- Test 4: Second Normal Patrol in Same Shift ---');
  const secondPatrol = await patrolSessionService.start(
    client.id,
    employee.id,
    assignment.id,
    false,
  );
  if (gate) {
    await prisma.patrolCheckpoint.create({
      data: {
        patrolSessionId: secondPatrol.id,
        gateId: gate.id,
        status: 'SCANNED',
        scannedAt: new Date(),
      },
    });
  }
  await patrolSessionService.complete(secondPatrol.id, 'Test second patrol completed');

  const secondNotif = await prisma.notification.findUnique({
    where: { idempotencyKey: `PATROL_COMPLETED_${secondPatrol.id}` },
  });
  if (!secondNotif || secondNotif.type !== 'PATROL_COMPLETED') {
    throw new Error('❌ Test 4 Failed: Second PATROL_COMPLETED notification not found!');
  }
  console.log('✅ Test 4 Passed: Second independent PATROL_COMPLETED notification created successfully');

  // Test 5: Mandatory Patrol Completion Notification (inside window)
  console.log('\n--- Test 5: Mandatory Patrol Completion Notification ---');
  const now = new Date();
  const testWindowStart = new Date(now.getTime() - 15 * 60 * 1000);
  const testWindowEnd = new Date(now.getTime() + 45 * 60 * 1000);

  const testMandatoryInst = await prisma.mandatoryPatrolInstance.create({
    data: {
      clientId: client.id,
      assignmentId: assignment.id,
      employeeId: employee.id,
      shiftId: assignment.shiftId!,
      shiftDate: now,
      sequence: 99,
      status: 'DUE',
      scheduledAt: now,
      windowStart: testWindowStart,
      windowEnd: testWindowEnd,
    },
  });

  const mandatoryPatrol = await patrolSessionService.start(
    client.id,
    employee.id,
    assignment.id,
    false,
  );
  if (gate) {
    await prisma.patrolCheckpoint.create({
      data: {
        patrolSessionId: mandatoryPatrol.id,
        gateId: gate.id,
        status: 'SCANNED',
        scannedAt: new Date(),
      },
    });
  }

  await patrolSessionService.complete(mandatoryPatrol.id, 'Test mandatory patrol completed');

  const mandatoryNotif = await prisma.notification.findUnique({
    where: { idempotencyKey: `MANDATORY_PATROL_COMPLETED_${testMandatoryInst.id}_${mandatoryPatrol.id}` },
  });

  if (!mandatoryNotif || mandatoryNotif.type !== 'MANDATORY_PATROL_COMPLETED') {
    throw new Error('❌ Test 5 Failed: MANDATORY_PATROL_COMPLETED notification not found!');
  }
  console.log('✅ Test 5 Passed: MANDATORY_PATROL_COMPLETED notification created:', mandatoryNotif.message);

  // Verify NO duplicate PATROL_COMPLETED for this mandatory patrol session
  const duplicateCheck = await prisma.notification.findUnique({
    where: { idempotencyKey: `PATROL_COMPLETED_${mandatoryPatrol.id}` },
  });
  if (duplicateCheck) {
    throw new Error('❌ Test 5 Failed: Duplicate generic PATROL_COMPLETED was created for mandatory patrol!');
  }
  console.log('✅ Test 5 Passed: Verified NO duplicate PATROL_COMPLETED was emitted for mandatory session');

  // Clean up test mandatory instance & test patrol sessions
  await prisma.mandatoryPatrolInstance.delete({ where: { id: testMandatoryInst.id } });
  await prisma.patrolCheckpoint.deleteMany({
    where: { patrolSessionId: { in: [normalPatrol.id, secondPatrol.id, mandatoryPatrol.id] } },
  });
  await prisma.patrolSession.deleteMany({
    where: { id: { in: [normalPatrol.id, secondPatrol.id, mandatoryPatrol.id] } },
  });

  console.log('\n🎉 ALL NOTIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error running tests:', e);
    process.exit(1);
  });
