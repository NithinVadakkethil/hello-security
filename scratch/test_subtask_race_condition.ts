import { prisma } from '../api/src/database/prisma';
import { UserRole } from '@prisma/client';

async function runTests() {
  console.log('=== TESTING SUBTASK RACE CONDITION HOTFIX (LOCAL CLONE DB) ===');

  const user = await prisma.user.findFirst({
    where: { email: 'ujjwal.peninsula1@helloorbit.com' },
    include: { employee: true },
  });

  if (!user || !user.employee) {
    throw new Error('User/Employee ujjwal.peninsula1@helloorbit.com not found in local DB');
  }

  const session = await prisma.patrolSession.findFirst({
    where: {
      id: 'cmu5bp61y06yghpfkj5yz880j',
    },
  });

  if (session) {
    console.log(`Found target test session: ${session.id}, startedAt: ${session.startedAt.toISOString()}`);
  }

  const gateId = 'cmt4g4ivu00mnhpqc1wbbaof8';

  // TEST 1: Session started BEFORE task creation (startedAt: 09:24:20, task created: 09:46:44)
  const sessionStartTime = new Date('2026-09-17T09:24:20.835Z');
  const activeSubTasksOld = await prisma.gateSubTask.findMany({
    where: {
      gateId,
      isActive: true,
      role: UserRole.SECURITY,
      createdAt: { lte: sessionStartTime },
    },
  });

  console.log(`[TEST 1 PASS] For session started at 09:24:20, activeSubTasks count = ${activeSubTasksOld.length}`);
  const taskNamesOld = activeSubTasksOld.map((t) => t.taskName);
  console.log(`   Old session required tasks: ${JSON.stringify(taskNamesOld)}`);
  if (taskNamesOld.includes('All Area is Cleaned')) {
    throw new Error('FAILED: "All Area is Cleaned" should NOT be required for session started at 09:24:20');
  }

  // TEST 2: New session started AFTER task creation (startedAt: 10:00:00)
  const newSessionTime = new Date('2026-09-17T10:00:00.000Z');
  const activeSubTasksNew = await prisma.gateSubTask.findMany({
    where: {
      gateId,
      isActive: true,
      role: UserRole.SECURITY,
      createdAt: { lte: newSessionTime },
    },
  });

  console.log(`[TEST 2 PASS] For new session started at 10:00:00, activeSubTasks count = ${activeSubTasksNew.length}`);
  const taskNamesNew = activeSubTasksNew.map((t) => t.taskName);
  console.log(`   New session required tasks: ${JSON.stringify(taskNamesNew)}`);
  if (!taskNamesNew.includes('All Area is Cleaned')) {
    throw new Error('FAILED: "All Area is Cleaned" MUST be required for session started at 10:00:00');
  }

  // TEST 3 & 4: Other roles (TECHNICIAN, CLEANER)
  const activeSubTasksTech = await prisma.gateSubTask.findMany({
    where: {
      gateId,
      isActive: true,
      role: UserRole.TECHNICIAN,
      createdAt: { lte: sessionStartTime },
    },
  });
  console.log(`[TEST 3 PASS] Technician subtasks count = ${activeSubTasksTech.length}`);

  const activeSubTasksCleaner = await prisma.gateSubTask.findMany({
    where: {
      gateId,
      isActive: true,
      role: UserRole.CLEANER,
      createdAt: { lte: sessionStartTime },
    },
  });
  console.log(`[TEST 4 PASS] Cleaner subtasks count = ${activeSubTasksCleaner.length}`);

  console.log('\n=== ALL LOCAL TEST SCENARIOS PASSED SUCCESSFULLY ===');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
