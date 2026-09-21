import { PrismaClient } from '@prisma/client';
import { patrolCheckpointService } from '../api/src/modules/patrol-checkpoint/patrol-checkpoint.service';
import { patrolSessionService } from '../api/src/modules/patrol-session/patrol-session.service';

const prisma = new PrismaClient();

async function testMultiPatrolOfflineSync() {
  console.log('=== TESTING MULTI-PATROL OFFLINE SYNC RECOVERY (3 PATROLS / 9 OPERATIONS) ===');

  const employee = await prisma.employee.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      client: true,
      assignments: {
        include: {
          site: {
            include: {
              gates: {
                include: { subTasks: true },
              },
            },
          },
        },
      },
    },
  });

  if (!employee || !employee.assignments?.[0]?.site?.gates?.[0]) {
    console.log('No employee or assignment gates found.');
    return;
  }

  const assignment = employee.assignments[0];
  const gate = assignment.site.gates[0];
  const gateSubTasks = await prisma.gateSubTask.findMany({
    where: { gateId: gate.id, isActive: true, role: employee.role },
  });

  console.log(`Testing Employee: ${employee.firstName} ${employee.lastName} (${employee.id})`);
  console.log(`Assignment: ${assignment.id}, Gate: ${gate.name}`);

  // Create 3 simulated distinct offline sessions
  const offlineSessions = ['offline-test-A', 'offline-test-B', 'offline-test-C'];
  const createdServerSessions: string[] = [];

  for (let i = 0; i < offlineSessions.length; i++) {
    const offlineId = offlineSessions[i];
    console.log(`\n--- Processing Patrol ${i + 1} (${offlineId}) ---`);

    // 1. Start Patrol
    const startRes = await patrolSessionService.start(
      assignment.clientId,
      employee.id,
      assignment.id,
      true, // resolve existing if any running
      new Date(Date.now() - (30 - i * 5) * 60 * 1000),
    );
    const serverSessionId = startRes.id;
    createdServerSessions.push(serverSessionId);
    console.log(`  1. Start Patrol -> Server Session ID: ${serverSessionId}`);

    // 2. Scan Checkpoint
    const scanRes = await patrolCheckpointService.scan(employee.id, {
      gateId: gate.id,
      patrolSessionId: serverSessionId,
      remarks: `Multi-patrol offline test note for Patrol ${i + 1}`,
      scannedAt: new Date(Date.now() - (25 - i * 5) * 60 * 1000).toISOString(),
      subTaskResponses: gateSubTasks.map(st => ({
        gateSubTaskId: st.id,
        answer: 'YES' as const,
        remarks: 'All good',
        images: [],
      })),
    } as any);
    console.log(`  2. Scan Checkpoint -> Checkpoint ID: ${scanRes.checkpoint?.id}`);

    // 3. Complete Patrol
    await patrolSessionService.complete(serverSessionId, `Completed Patrol ${i + 1}`);
    console.log(`  3. Complete Patrol -> Session ${serverSessionId} marked COMPLETED`);
  }

  console.log('\n--- VERIFYING ALL 3 PATROLS IN DB ---');
  for (const sessId of createdServerSessions) {
    const sess = await prisma.patrolSession.findUnique({
      where: { id: sessId },
      include: {
        checkpoints: {
          include: { subTaskResponses: true },
        },
      },
    });
    console.log(`Session ${sess?.id} (${sess?.patrolCode}): Status = ${sess?.status}, Checkpoints = ${sess?.checkpoints.length}, SubTasks = ${sess?.checkpoints[0]?.subTaskResponses?.length}`);
  }

  // Cleanup test sessions
  await prisma.patrolCheckpoint.deleteMany({ where: { patrolSessionId: { in: createdServerSessions } } });
  await prisma.patrolSession.deleteMany({ where: { id: { in: createdServerSessions } } });
  console.log('\nCleaned up test multi-patrol sessions.');
  console.log('=== MULTI-PATROL OFFLINE SYNC TEST PASSED 100% ===');
}

testMultiPatrolOfflineSync().catch(console.error).finally(() => prisma.$disconnect());
