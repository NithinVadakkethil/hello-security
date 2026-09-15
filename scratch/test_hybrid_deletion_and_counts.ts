import { prisma } from '../api/src/database/prisma';
import { gateRepository } from '../api/src/modules/gate/gate.repository';
import { subTaskMasterService } from '../api/src/modules/subtask-master/subtask-master.service';
import { gateSubTaskService } from '../api/src/modules/gate-sub-task/gate-sub-task.service';
import { UserRole } from '@prisma/client';

async function runTests() {
  console.log('=== STARTING HYBRID DELETION & SUBTASK COUNT VERIFICATION TESTS ===\n');

  // Clean up any lingering test manual tasks
  await prisma.gateSubTask.deleteMany({ where: { taskName: { contains: 'Test Manual Task' } } });

  // TEST 1: Vespa Perinthalmanna Checkpoint Counts
  console.log('--- TEST 1: Check Vespa Perinthalmanna Checkpoint Counts ---');
  const vespaSite = await prisma.site.findFirst({
    where: { name: { contains: 'Vespa', mode: 'insensitive' } },
  });

  if (vespaSite) {
    const gateListResult = await gateRepository.list(vespaSite.id);
    const gates = Array.isArray(gateListResult) ? gateListResult : gateListResult.items;

    console.log(`Vespa Site Gates Count: ${gates.length}`);
    gates.forEach((g) => {
      const activeCount = g.subTasks.length;
      console.log(`Checkpoint "${g.name}" -> Active Sub Tasks count: ${activeCount}`);
      if (activeCount !== 3) {
        throw new Error(`Expected active count 3 for gate "${g.name}", got ${activeCount}`);
      }
    });
    console.log('TEST 1 PASSED: All Vespa checkpoints report active count = 3.');
  }

  // TEST 2: Manual Task Addition Test
  console.log('\n--- TEST 2: Manual Task Addition Test ---');
  let testGate = await prisma.gate.findFirst();
  if (!testGate) throw new Error('No test gate found');

  const initialGateData = await gateRepository.findById(testGate.id);
  const initialActiveCount = initialGateData?.subTasks.length || 0;

  // Add a manual active task
  const manualTask = await gateSubTaskService.create(
    testGate.id,
    {
      taskName: `Test Manual Task ${Date.now()}`,
      description: 'Manual inspection item',
      role: 'SECURITY' as UserRole,
      isRequired: true,
      isActive: true,
    }
  );

  const updatedGateData = await gateRepository.findById(testGate.id);
  const updatedActiveCount = updatedGateData?.subTasks.length || 0;
  console.log(`Initial count: ${initialActiveCount}, After manual task: ${updatedActiveCount}`);

  if (updatedActiveCount !== initialActiveCount + 1) {
    throw new Error(`Expected count ${initialActiveCount + 1}, got ${updatedActiveCount}`);
  }
  console.log('TEST 2 PASSED: Active manual task correctly included in count.');

  // TEST 3: Hybrid Deletion Strategy Test (Unused hard-deleted, Used soft-deleted)
  console.log('\n--- TEST 3: Hybrid Deletion Strategy Test ---');
  // Create client & site for isolated test
  const testClient = await prisma.client.create({
    data: { companyName: `Hybrid Company ${Date.now()}`, email: `hybrid_${Date.now()}@test.com`, clientCode: `HYB-${Date.now()}` },
  });
  const testSite = await prisma.site.create({
    data: { clientId: testClient.id, name: 'Hybrid Site', siteCode: `HYB-${Date.now()}` },
  });
  const testGate2 = await prisma.gate.create({
    data: { siteId: testSite.id, name: 'Hybrid Gate', gateCode: `HG-${Date.now()}`, sequence: 1 },
  });

  // Step A: Save Master with Task A (used) and Task B (unused)
  await subTaskMasterService.saveMaster(testClient.id, {
    role: 'SECURITY' as UserRole,
    name: 'Security Master',
    items: [
      { taskName: 'Task A (Will Have History)', isRequired: true, isActive: true },
      { taskName: 'Task B (Unused Stale)', isRequired: true, isActive: true },
    ],
  });

  await subTaskMasterService.executeApplyMaster(testClient.id, testSite.id, ['SECURITY' as UserRole]);
  let checkpointSubTasks = await prisma.gateSubTask.findMany({ where: { gateId: testGate2.id } });
  console.log('Initially applied subtasks count:', checkpointSubTasks.length);

  const taskA = checkpointSubTasks.find((st) => st.taskName.includes('Task A'));
  const taskB = checkpointSubTasks.find((st) => st.taskName.includes('Task B'));

  if (!taskA || !taskB) throw new Error('Task A or Task B missing after initial apply');

  // Add historical response to Task A only
  const testSession = await prisma.patrolSession.create({
    data: { clientId: testClient.id, status: 'COMPLETED', patrolCode: `P-${Date.now()}`, startedAt: new Date() },
  });
  const testCheckpoint = await prisma.patrolCheckpoint.create({
    data: { patrolSessionId: testSession.id, gateId: testGate2.id, scannedAt: new Date() },
  });
  const testResponse = await prisma.patrolSubTaskResponse.create({
    data: { patrolCheckpointId: testCheckpoint.id, gateSubTaskId: taskA.id, answer: 'YES' },
  });

  // Step B: Update Master to remove BOTH Task A and Task B -> Apply Master
  await subTaskMasterService.saveMaster(testClient.id, {
    role: 'SECURITY' as UserRole,
    name: 'Security Master',
    items: [{ taskName: 'Task C (New Master Task)', isRequired: true, isActive: true }],
  });

  await subTaskMasterService.executeApplyMaster(testClient.id, testSite.id, ['SECURITY' as UserRole]);

  // Check DB state for Task A and Task B
  const dbTaskA = await prisma.gateSubTask.findUnique({ where: { id: taskA.id } });
  const dbTaskB = await prisma.gateSubTask.findUnique({ where: { id: taskB.id } });

  console.log('Task A (used) in DB:', dbTaskA ? `Found (isActive = ${dbTaskA.isActive})` : 'Deleted');
  console.log('Task B (unused) in DB:', dbTaskB ? `Found (isActive = ${dbTaskB.isActive})` : 'Deleted (Physically removed)');

  if (!dbTaskA || dbTaskA.isActive !== false) {
    throw new Error('FAILED: Used Task A was not soft-deleted!');
  }
  if (dbTaskB !== null) {
    throw new Error('FAILED: Unused Task B was not hard-deleted!');
  }

  const activeGateSubtasks = await gateRepository.findById(testGate2.id);
  console.log('Gate active subtasks count after hybrid apply:', activeGateSubtasks?.subTasks.length);
  console.log('Gate active subtask names:', activeGateSubtasks?.subTasks.map((t) => t.taskName));

  if (activeGateSubtasks?.subTasks.length !== 1) {
    throw new Error(`Expected active count 1, got ${activeGateSubtasks?.subTasks.length}`);
  }
  console.log('TEST 3 PASSED: Hybrid deletion strategy correctly hard-deleted unused task and soft-deleted used task.');

  // Clean up test manual task & test client
  await gateSubTaskService.delete(manualTask.id);
  await prisma.patrolSubTaskResponse.deleteMany({ where: { id: testResponse.id } });
  await prisma.patrolCheckpoint.deleteMany({ where: { id: testCheckpoint.id } });
  await prisma.patrolSession.deleteMany({ where: { id: testSession.id } });
  await prisma.gateSubTask.deleteMany({ where: { gateId: testGate2.id } });
  await prisma.subTaskMaster.deleteMany({ where: { clientId: testClient.id } });
  await prisma.gate.delete({ where: { id: testGate2.id } });
  await prisma.site.delete({ where: { id: testSite.id } });
  await prisma.client.delete({ where: { id: testClient.id } });

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
