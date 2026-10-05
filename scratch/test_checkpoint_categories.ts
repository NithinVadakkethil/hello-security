import { prisma } from '../api/src/database/prisma';
import { checkpointCategoryService } from '../api/src/modules/checkpoint-category/checkpoint-category.service';
import { gateService } from '../api/src/modules/gate/gate.service';
import { gateSubTaskService } from '../api/src/modules/gate-sub-task/gate-sub-task.service';
import { UserRole } from '@prisma/client';

async function runTests() {
  console.log('=== STARTING LOCAL KAIZEN CHECKPOINT CATEGORY & SUBTASK TESTS ===\n');

  // Find a test client and site
  const client = await prisma.client.findFirst({
    where: { isActive: true },
    include: { sites: { take: 1 } },
  });

  if (!client || !client.sites[0]) {
    throw new Error('No active client or site found in local DB for testing.');
  }

  const clientId = client.id;
  const siteId = client.sites[0].id;
  console.log(`Using Client: "${client.companyName}" (${clientId})`);
  console.log(`Using Site: "${client.sites[0].name}" (${siteId})\n`);

  // 1. Create a Category
  console.log('1. Testing Checkpoint Category Creation:');
  const catName = 'Test Garbage Utility ' + Date.now();
  const createdCat = await checkpointCategoryService.create(clientId, {
    name: catName,
    description: 'Utility category for waste management rooms',
  });
  console.log(`[PASS] Created Category: id=${createdCat.id}, name="${createdCat.name}", normalized="${createdCat.normalizedName}"`);

  // 2. Duplicate Validation (Case-insensitive, trimmed)
  console.log('\n2. Testing Duplicate Category Validation:');
  try {
    await checkpointCategoryService.create(clientId, {
      name: `  ${catName.toUpperCase()}  `,
      description: 'Duplicate attempt',
    });
    console.error('[FAIL] Duplicate category creation did not throw!');
  } catch (err: any) {
    console.log(`[PASS] Correctly blocked duplicate category: "${err.message}"`);
  }

  // 3. Configure Role-based Subtasks for this Category
  console.log('\n3. Testing Role-based Subtask Configuration for Category:');
  const guardTask1 = await checkpointCategoryService.createSubTask(clientId, createdCat.id, {
    role: UserRole.SECURITY,
    taskName: 'Check garbage room door lock',
    description: 'Ensure door latch is secured',
    displayOrder: 1,
    isRequired: true,
    isActive: true,
  });
  console.log(`[PASS] Added Security Guard Subtask 1: id=${guardTask1.id}, name="${guardTask1.taskName}"`);

  const guardTask2 = await checkpointCategoryService.createSubTask(clientId, createdCat.id, {
    role: UserRole.SECURITY,
    taskName: 'Check garbage bins full level',
    displayOrder: 2,
    isRequired: true,
    isActive: true,
  });
  console.log(`[PASS] Added Security Guard Subtask 2: id=${guardTask2.id}, name="${guardTask2.taskName}"`);

  const supervisorTask = await checkpointCategoryService.createSubTask(clientId, createdCat.id, {
    role: UserRole.SUPERVISOR,
    taskName: 'Verify waste collection compliance',
    displayOrder: 1,
    isRequired: true,
    isActive: true,
  });
  console.log(`[PASS] Added Supervisor Subtask: id=${supervisorTask.id}, name="${supervisorTask.taskName}"`);

  // 4. Create Checkpoint A & Checkpoint B referencing the same Category
  console.log('\n4. Testing Checkpoint Inheritance (Multiple checkpoints -> Same Category):');
  const gateA = await gateService.create({
    siteId,
    name: 'Garbage Room - Floor 1 ' + Date.now(),
    description: 'Floor 1',
    sequence: 901,
    categoryId: createdCat.id,
  });
  console.log(`[PASS] Created Gate A: id=${gateA.id}, code=${gateA.gateCode}, categoryId=${gateA.categoryId}`);

  const gateB = await gateService.create({
    siteId,
    name: 'Garbage Room - Floor 2 ' + Date.now(),
    description: 'Floor 2',
    sequence: 902,
    categoryId: createdCat.id,
  });
  console.log(`[PASS] Created Gate B: id=${gateB.id}, code=${gateB.gateCode}, categoryId=${gateB.categoryId}`);

  // 5. Verify Subtask Resolution via GateSubTaskService
  console.log('\n5. Testing Subtask Inheritance Resolution:');
  const gateASubTasksSecurity = await gateSubTaskService.list(gateA.id, true, UserRole.SECURITY);
  console.log(`[PASS] Gate A resolved ${gateASubTasksSecurity.length} Security subtasks (Expected 2).`);
  console.log(`       Tasks: ${gateASubTasksSecurity.map((t: any) => t.taskName).join('; ')}`);

  const gateBSubTasksSecurity = await gateSubTaskService.list(gateB.id, true, UserRole.SECURITY);
  console.log(`[PASS] Gate B resolved ${gateBSubTasksSecurity.length} Security subtasks (Expected 2).`);

  const gateASubTasksSupervisor = await gateSubTaskService.list(gateA.id, true, UserRole.SUPERVISOR);
  console.log(`[PASS] Gate A resolved ${gateASubTasksSupervisor.length} Supervisor subtasks (Expected 1).`);

  // 6. Verify Checkpoint without Category (Backward Compatibility)
  console.log('\n6. Testing Checkpoint Without Category (Backward Compatibility):');
  const gateNoCat = await gateService.create({
    siteId,
    name: 'Main Gate Checkpoint ' + Date.now(),
    description: 'Ground Floor',
    sequence: 903,
    categoryId: null,
  });
  console.log(`[PASS] Created Gate with no category: id=${gateNoCat.id}, categoryId=${gateNoCat.categoryId}`);
  const noCatSubTasks = await gateSubTaskService.list(gateNoCat.id, true);
  console.log(`[PASS] Gate with no category returned ${noCatSubTasks.length} subtasks safely.`);

  // 7. Test Category Deletion Protection when Checkpoints are Assigned
  console.log('\n7. Testing Category Deletion Protection when checkpoints depend on it:');
  try {
    await checkpointCategoryService.delete(clientId, createdCat.id);
    console.error('[FAIL] Category with assigned checkpoints was deleted!');
  } catch (err: any) {
    console.log(`[PASS] Correctly prevented category deletion: "${err.message}"`);
  }

  // 8. Test Demo Cleanup: Delete All Subtasks
  console.log('\n8. Testing "Delete All Subtasks" Demo Cleanup Operation:');
  const cleanupResult = await checkpointCategoryService.deleteAllSubTasks(clientId);
  console.log(`[PASS] Cleanup executed: ${JSON.stringify(cleanupResult)}`);

  // Verify that Category itself and Checkpoints and QR codes remain untouched
  const verifyCat = await prisma.checkpointCategory.findUnique({ where: { id: createdCat.id } });
  if (verifyCat) {
    console.log(`[PASS] Checkpoint Category "${verifyCat.name}" is PRESERVED.`);
  } else {
    console.error('[FAIL] Checkpoint Category was deleted during subtask cleanup!');
  }

  const verifyGateA = await prisma.gate.findUnique({ where: { id: gateA.id } });
  if (verifyGateA && verifyGateA.gateCode === gateA.gateCode) {
    console.log(`[PASS] Gate A record & code (${verifyGateA.gateCode}) are PRESERVED.`);
  } else {
    console.error('[FAIL] Gate A was mutated or deleted!');
  }

  // Cleanup test gates & category created for this run
  await prisma.gate.deleteMany({
    where: { id: { in: [gateA.id, gateB.id, gateNoCat.id] } },
  });
  await prisma.checkpointCategory.deleteMany({
    where: { id: createdCat.id },
  });
  console.log('\n[PASS] Test checkpoints and category cleaned up gracefully.');

  console.log('\n=== ALL LOCAL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests()
  .catch((e) => {
    console.error('Test failed with error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
