import { prisma } from '../api/src/database/prisma';
import { subTaskMasterService } from '../api/src/modules/subtask-master/subtask-master.service';
import { gateSubTaskService } from '../api/src/modules/gate-sub-task/gate-sub-task.service';
import { UserRole } from '@prisma/client';

async function runTests() {
  console.log('=== STARTING CHECKPOINT SUBTASK FIX VERIFICATION TESTS ===\n');

  // 1. Get or create test site & gate
  let client = await prisma.client.findFirst();
  if (!client) {
    client = await prisma.client.create({
      data: { name: 'Test Client', email: 'test@example.com' },
    });
  }
  const clientId = client.id;

  let site = await prisma.site.findFirst({ where: { clientId } });
  if (!site) {
    site = await prisma.site.create({
      data: { clientId, name: 'Showroom Site', siteCode: 'SR-001' },
    });
  }

  let gate = await prisma.gate.findFirst({ where: { siteId: site.id } });
  if (!gate) {
    gate = await prisma.gate.create({
      data: { siteId: site.id, name: 'Main Gate', gateCode: 'MG-001', qrCode: 'QR-MG-001', sequence: 1 },
    });
  }
  const gateId = gate.id;
  console.log(`Using Site ID: ${site.id}, Gate ID: ${gateId}`);

  // Clean up existing master and gate subtasks for clean test baseline
  await prisma.subTaskMaster.deleteMany({
    where: { clientId, role: { in: ['SECURITY' as UserRole, 'TECHNICIAN' as UserRole, 'MANAGER' as UserRole] } },
  });
  await prisma.gateSubTask.deleteMany({ where: { gateId } });

  // TEST 1: Initial Master setup (3 Security tasks) -> Apply Master
  console.log('\n--- TEST 1: Apply Master with 3 Security tasks ---');
  await subTaskMasterService.saveMaster(clientId, {
    role: 'SECURITY' as UserRole,
    name: 'Security Master',
    items: [
      { taskName: 'Doors inches are well', isRequired: true, isActive: true },
      { taskName: 'Doors are Closed and Cleaned', isRequired: true, isActive: true },
      { taskName: 'the new security sub task', isRequired: true, isActive: true },
    ],
  });

  await subTaskMasterService.executeApplyMaster(clientId, site.id, ['SECURITY' as UserRole]);

  let activeTasks = await gateSubTaskService.list(gateId, true, 'SECURITY' as UserRole);
  console.log('Showroom active Security count before delete:', activeTasks.length);
  console.log('Showroom visible Security tasks before delete:', activeTasks.map((t) => t.taskName));

  if (activeTasks.length !== 3) {
    throw new Error(`Expected 3 active tasks, got ${activeTasks.length}`);
  }

  // TEST 2: Delete "the new security sub task" from Master -> Apply Master Tasks
  console.log('\n--- TEST 2: Delete Master task & Apply Master ---');
  await subTaskMasterService.saveMaster(clientId, {
    role: 'SECURITY' as UserRole,
    name: 'Security Master',
    items: [
      { taskName: 'Doors inches are well', isRequired: true, isActive: true },
      { taskName: 'Doors are Closed and Cleaned', isRequired: true, isActive: true },
    ],
  });

  await subTaskMasterService.executeApplyMaster(clientId, site.id, ['SECURITY' as UserRole]);

  // Query DB total records vs active list API
  const allDbRecords = await prisma.gateSubTask.findMany({ where: { gateId, role: 'SECURITY' as UserRole } });
  const activeDbRecords = await prisma.gateSubTask.findMany({ where: { gateId, role: 'SECURITY' as UserRole, isActive: true } });
  activeTasks = await gateSubTaskService.list(gateId, true, 'SECURITY' as UserRole);

  console.log('Total DB records (including soft-deleted):', allDbRecords.length);
  console.log('Showroom active Security count after delete:', activeDbRecords.length);
  console.log('Showroom visible Security tasks after delete:', activeTasks.map((t) => t.taskName));

  const hasDeletedTaskInVisible = activeTasks.some((t) => t.taskName === 'the new security sub task');
  if (hasDeletedTaskInVisible) {
    throw new Error('FAILED: Stale deleted task is still visible in active subtask list!');
  }
  if (allDbRecords.length < 3) {
    throw new Error('FAILED: Historical DB record was hard-deleted when it should be soft-deleted!');
  }
  console.log('TEST 2 PASSED: Deleted Master task soft-deleted in DB & hidden from modal list & counts.');

  // TEST 3: Historical Patrol Response Preservation
  console.log('\n--- TEST 3: Verify Historical Patrol Response Preservation ---');
  const inactiveTask = allDbRecords.find((t) => t.taskName === 'the new security sub task');
  if (!inactiveTask) {
    throw new Error('FAILED: Inactive task record missing in DB');
  }

  // Create a dummy patrol session & checkpoint response for inactiveTask
  const patrolCode = `P-TEST-${Date.now()}`;
  const session = await prisma.patrolSession.create({
    data: {
      clientId,
      status: 'COMPLETED',
      patrolCode,
      startedAt: new Date(),
      endedAt: new Date(),
    },
  });

  const checkpoint = await prisma.patrolCheckpoint.create({
    data: {
      patrolSessionId: session.id,
      gateId,
      scannedAt: new Date(),
    },
  });

  const response = await prisma.patrolSubTaskResponse.create({
    data: {
      patrolCheckpointId: checkpoint.id,
      gateSubTaskId: inactiveTask.id,
      answer: 'YES',
      remarks: 'Verified during old patrol',
    },
  });

  // Query historical session with responses
  const fetchedResponse = await prisma.patrolSubTaskResponse.findUnique({
    where: { id: response.id },
    include: { gateSubTask: true },
  });

  if (!fetchedResponse || fetchedResponse.gateSubTask?.taskName !== 'the new security sub task') {
    throw new Error('FAILED: Historical patrol response could not resolve deleted subtask!');
  }
  console.log('Historical response resolved taskName:', fetchedResponse.gateSubTask.taskName);
  console.log('TEST 3 PASSED: Historical report data preserved cleanly.');

  // TEST 4: Re-adding Master Task
  console.log('\n--- TEST 4: Re-adding Master Task ---');
  await subTaskMasterService.saveMaster(clientId, {
    role: 'SECURITY' as UserRole,
    name: 'Security Master',
    items: [
      { taskName: 'Doors inches are well', isRequired: true, isActive: true },
      { taskName: 'Doors are Closed and Cleaned', isRequired: true, isActive: true },
      { taskName: 'the new security sub task', isRequired: true, isActive: true },
    ],
  });

  await subTaskMasterService.executeApplyMaster(clientId, site.id, ['SECURITY' as UserRole]);
  activeTasks = await gateSubTaskService.list(gateId, true, 'SECURITY' as UserRole);
  console.log('After re-adding task - visible Security count:', activeTasks.length);
  console.log('After re-adding task - visible Security tasks:', activeTasks.map((t) => t.taskName));

  if (activeTasks.length !== 3) {
    throw new Error(`Expected 3 active tasks after re-adding, got ${activeTasks.length}`);
  }
  console.log('TEST 4 PASSED: Re-added Master task reactivated without duplicates.');

  // Clean up test data
  await prisma.patrolSubTaskResponse.deleteMany({ where: { id: response.id } });
  await prisma.patrolCheckpoint.deleteMany({ where: { id: checkpoint.id } });
  await prisma.patrolSession.deleteMany({ where: { id: session.id } });
  await prisma.subTaskMaster.deleteMany({
    where: { clientId, role: { in: ['SECURITY' as UserRole, 'TECHNICIAN' as UserRole, 'MANAGER' as UserRole] } },
  });
  await prisma.gateSubTask.deleteMany({ where: { gateId } });

  console.log('\n=== ALL CHECKPOINT SUBTASK VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
