import { prisma } from '../api/src/database/prisma';
import { subTaskMasterService } from '../api/src/modules/subtask-master/subtask-master.service';
import { subTaskMasterRepository } from '../api/src/modules/subtask-master/subtask-master.repository';
import { UserRole } from '@prisma/client';

async function runTests() {
  console.log('=== STARTING SUBTASK MASTER VERIFICATION TESTS ===\n');

  // 1. Get or create a test client ID
  let client = await prisma.client.findFirst();
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: 'Test Client',
        email: 'test@example.com',
      },
    });
  }
  const clientId = client.id;
  console.log(`Using Client ID: ${clientId}`);

  // Clean up any existing test masters for SECURITY and TECHNICIAN roles for this client
  await prisma.subTaskMaster.deleteMany({
    where: { clientId, role: { in: ['SECURITY' as UserRole, 'TECHNICIAN' as UserRole] } },
  });

  // TEST 1: Save Master with A, B, C -> then Delete B -> Save Master
  console.log('\n--- TEST 1: Delete existing task ---');
  const initialItems = [
    { taskName: 'Doors are Closed and Cleaned', isRequired: true, isActive: true },
    { taskName: 'Doors inches are well', isRequired: true, isActive: true },
    { taskName: 'Doors are proper', isRequired: true, isActive: true },
  ];

  await subTaskMasterService.saveMaster(clientId, {
    role: 'SECURITY' as UserRole,
    name: 'SECURITY Master',
    items: initialItems,
  });

  let currentMaster = await subTaskMasterRepository.findByClientAndRole(clientId, 'SECURITY' as UserRole);
  console.log('Initial DB items count:', currentMaster?.items.length);
  console.log('Initial items:', currentMaster?.items.map((i) => i.taskName));

  if (currentMaster?.items.length !== 3) {
    throw new Error(`Expected 3 items initially, got ${currentMaster?.items.length}`);
  }

  // Now simulate user deleting "Doors inches are well" (item B) from Master UI
  const remainingItemsAfterDeleteB = currentMaster.items
    .filter((i) => i.taskName !== 'Doors inches are well')
    .map((i) => ({
      id: i.id,
      taskName: i.taskName,
      isRequired: i.isRequired,
      isActive: i.isActive,
    }));

  await subTaskMasterService.saveMaster(clientId, {
    role: 'SECURITY' as UserRole,
    name: 'SECURITY Master',
    items: remainingItemsAfterDeleteB,
  });

  // Fetch updated master
  currentMaster = await subTaskMasterRepository.findByClientAndRole(clientId, 'SECURITY' as UserRole);
  console.log('After deleting B - DB active items count:', currentMaster?.items.length);
  console.log('After deleting B - active items:', currentMaster?.items.map((i) => i.taskName));

  const hasItemB = currentMaster?.items.some((i) => i.taskName === 'Doors inches are well');
  if (hasItemB) {
    throw new Error('FAILED: Deleted task "Doors inches are well" still present in active items query!');
  }
  console.log('TEST 1 PASSED: Deleted task did NOT reappear.');

  // TEST 2: Delete + Add in same save (Delete C, Add D)
  console.log('\n--- TEST 2: Delete + Add in same save ---');
  const itemsForTest2 = [
    ...currentMaster!.items
      .filter((i) => i.taskName !== 'Doors are proper')
      .map((i) => ({
        id: i.id,
        taskName: i.taskName,
        isRequired: i.isRequired,
        isActive: i.isActive,
      })),
    { taskName: 'Doors are okay with Proper (New Task D)', isRequired: true, isActive: true },
  ];

  await subTaskMasterService.saveMaster(clientId, {
    role: 'SECURITY' as UserRole,
    name: 'SECURITY Master',
    items: itemsForTest2,
  });

  currentMaster = await subTaskMasterRepository.findByClientAndRole(clientId, 'SECURITY' as UserRole);
  console.log('After Delete C + Add D - active items:', currentMaster?.items.map((i) => i.taskName));

  const itemNamesTest2 = currentMaster?.items.map((i) => i.taskName);
  if (itemNamesTest2?.includes('Doors are proper')) {
    throw new Error('FAILED: Deleted item C is still present!');
  }
  if (!itemNamesTest2?.includes('Doors are okay with Proper (New Task D)')) {
    throw new Error('FAILED: New item D was not added!');
  }
  console.log('TEST 2 PASSED: Delete C + Add D handled correctly.');

  // TEST 3: Role Isolation (Save Technician Master, check Security Master unchanged)
  console.log('\n--- TEST 3: Role isolation ---');
  await subTaskMasterService.saveMaster(clientId, {
    role: 'TECHNICIAN' as UserRole,
    name: 'TECHNICIAN Master',
    items: [{ taskName: 'Check Generator Fuel', isRequired: true, isActive: true }],
  });

  const techMaster = await subTaskMasterRepository.findByClientAndRole(clientId, 'TECHNICIAN' as UserRole);
  const secMasterAfterTech = await subTaskMasterRepository.findByClientAndRole(clientId, 'SECURITY' as UserRole);

  console.log('Tech Master items:', techMaster?.items.map((i) => i.taskName));
  console.log('Security Master items count:', secMasterAfterTech?.items.length);

  if (techMaster?.items.length !== 1 || secMasterAfterTech?.items.length !== currentMaster?.items.length) {
    throw new Error('FAILED: Role isolation violated!');
  }
  console.log('TEST 3 PASSED: Role isolation preserved.');

  // TEST 4: Delete All
  console.log('\n--- TEST 4: Delete all tasks ---');
  await subTaskMasterService.saveMaster(clientId, {
    role: 'SECURITY' as UserRole,
    name: 'SECURITY Master',
    items: [],
  });

  currentMaster = await subTaskMasterRepository.findByClientAndRole(clientId, 'SECURITY' as UserRole);
  console.log('After Delete All - active items count:', currentMaster?.items.length);

  if (currentMaster?.items.length !== 0) {
    throw new Error('FAILED: Delete all did not empty the active master items!');
  }
  console.log('TEST 4 PASSED: Delete all resulted in empty active master.');

  // Clean up test data
  await prisma.subTaskMaster.deleteMany({
    where: { clientId, role: { in: ['SECURITY' as UserRole, 'TECHNICIAN' as UserRole] } },
  });

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests()
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
