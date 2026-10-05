import { prisma } from '../api/src/database/prisma';
import { gateRepository } from '../api/src/modules/gate/gate.repository';
import { UserRole } from '@prisma/client';

async function testGateSubTaskCount() {
  console.log('Testing Gate Subtask Count Resolution...');

  // 1. Pick a client
  const client = await prisma.client.findFirst({
    where: { isActive: true },
    include: { sites: { take: 1 } },
  });

  if (!client || !client.sites[0]) {
    throw new Error('No client or site found');
  }

  const clientId = client.id;
  const siteId = client.sites[0].id;

  // 2. Create a Category with 3 subtasks
  const cat = await prisma.checkpointCategory.create({
    data: {
      clientId,
      name: 'Test Category Subtask Count ' + Date.now(),
      normalizedName: 'test category subtask count ' + Date.now(),
      subTasks: {
        create: [
          { role: UserRole.SECURITY, taskName: 'Task 1', displayOrder: 1, isActive: true },
          { role: UserRole.SECURITY, taskName: 'Task 2', displayOrder: 2, isActive: true },
          { role: UserRole.CLEANER, taskName: 'Task 3', displayOrder: 1, isActive: true },
        ],
      },
    },
    include: { subTasks: true },
  });

  console.log(`Created Category "${cat.name}" with ${cat.subTasks.length} subtasks.`);

  // 3. Create Gate linked to this category
  const gate = await prisma.gate.create({
    data: {
      siteId,
      gateCode: 'TEST-GATE-COUNT-' + Date.now(),
      name: 'Category Checkpoint Test',
      sequence: 9999,
      categoryId: cat.id,
    },
  });

  // 4. Query via GateRepository.list and GateRepository.findById
  const fetchedList = await gateRepository.list(siteId);
  const foundGateInList = (Array.isArray(fetchedList) ? fetchedList : (fetchedList as any).items).find(
    (g: any) => g.id === gate.id
  );

  const foundGateById = await gateRepository.findById(gate.id);

  console.log('foundGateInList category subTasks:', foundGateInList?.category?.subTasks?.length);
  console.log('foundGateById category subTasks:', foundGateById?.category?.subTasks?.length);

  if (!foundGateInList?.category?.subTasks || foundGateInList.category.subTasks.length !== 3) {
    throw new Error('Failed to resolve category subtasks in gateRepository.list');
  }

  if (!foundGateById?.category?.subTasks || foundGateById.category.subTasks.length !== 3) {
    throw new Error('Failed to resolve category subtasks in gateRepository.findById');
  }

  console.log('[PASS] Gate list and findById now include category.subTasks with active subtask count!');

  // Cleanup test data
  await prisma.gate.delete({ where: { id: gate.id } });
  await prisma.categorySubTask.deleteMany({ where: { categoryId: cat.id } });
  await prisma.checkpointCategory.delete({ where: { id: cat.id } });
  console.log('[PASS] Test data cleaned up.');
}

testGateSubTaskCount()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
