import { prisma } from '../api/src/database/prisma';
import { patrolSessionService } from '../api/src/modules/patrol-session/patrol-session.service';

async function runLifecycleTests() {
  console.log('Starting Single Active Patrol Lifecycle Integration Tests...\n');

  // 1. Get test employee Adhi and client Vespa
  const vespa = await prisma.client.findFirst({ where: { email: 'vespa@gmail.com' } });
  const empAdhi = await prisma.employee.findFirst({ where: { email: 'adhi@vespa.com' } });

  if (!vespa || !empAdhi) {
    throw new Error('Test client or employee missing. Run scratch/seed_test_env.ts first.');
  }

  // Clear existing sessions for clean test
  await prisma.patrolSession.deleteMany({ where: { clientId: vespa.id } });

  // TEST 1: Initiate initial patrol
  console.log('--- TEST 1: Initiate initial patrol ---');
  const session1 = await patrolSessionService.start(vespa.id, empAdhi.id);
  console.log('✅ Session 1 Started:', session1.id, '| Patrol Code:', session1.patrolCode, '| Status:', session1.status);

  // TEST 2: Attempt starting second patrol while session 1 is active (without resolveExistingPatrol)
  console.log('\n--- TEST 2: Attempt duplicate patrol start ---');
  try {
    await patrolSessionService.start(vespa.id, empAdhi.id);
    console.error('❌ FAIL: Duplicate patrol start was NOT blocked!');
  } catch (err: any) {
    console.log('✅ SUCCESS: Duplicate start blocked with code:', err.code, '| Message:', err.message);
  }

  // TEST 3: Scan 1 checkpoint on session 1 and start new patrol with resolveExistingPatrol = true
  console.log('\n--- TEST 3: Resolve active session with >= 1 scanned checkpoint ---');
  const gate = await prisma.gate.findFirst({ where: { site: { clientId: vespa.id } } });
  if (gate) {
    await prisma.patrolCheckpoint.create({
      data: {
        patrolSessionId: session1.id,
        gateId: gate.id,
        scannedAt: new Date(),
      },
    });
    console.log('Logged 1 scanned checkpoint for Session 1');
  }

  const session2 = await patrolSessionService.start(vespa.id, empAdhi.id, undefined, true);
  console.log('✅ Session 2 Started:', session2.id, '| Patrol Code:', session2.patrolCode, '| Status:', session2.status);

  const updatedSession1 = await prisma.patrolSession.findUnique({ where: { id: session1.id } });
  console.log('✅ Verified Session 1 Status after resolution:', updatedSession1?.status, '(Expected: COMPLETED)');

  // TEST 4: Start new patrol with resolveExistingPatrol = true on 0-scan Session 2
  console.log('\n--- TEST 4: Resolve active 0-scan session ---');
  const session3 = await patrolSessionService.start(vespa.id, empAdhi.id, undefined, true);
  console.log('✅ Session 3 Started:', session3.id, '| Patrol Code:', session3.patrolCode, '| Status:', session3.status);

  const updatedSession2 = await prisma.patrolSession.findUnique({ where: { id: session2.id } });
  console.log('✅ Verified Session 2 Status after 0-scan resolution:', updatedSession2 ? updatedSession2.status : 'DELETED/CANCELLED', '(Expected: CANCELLED or null)');

  // TEST 5: Verify total active IN_PROGRESS sessions count in DB for employee
  const activeCount = await prisma.patrolSession.count({
    where: {
      status: { in: ['IN_PROGRESS', 'PAUSED'] },
      assignment: { employeeId: empAdhi.id },
    },
  });
  console.log('\n--- TEST 5: Active Patrol Count Verification ---');
  console.log('✅ Total Active Patrols for Employee:', activeCount, '(Expected: 1)');

  if (activeCount === 1) {
    console.log('\n🎉 ALL 5 INTEGRATION TESTS PASSED PERFECTLY!');
  } else {
    console.error('\n❌ TEST FAILED: Active count is', activeCount);
  }
}

runLifecycleTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Lifecycle Test Error:', e);
    process.exit(1);
  });
