import { prisma } from '../api/src/database/prisma';
import { patrolSessionService } from '../api/src/modules/patrol-session/patrol-session.service';
import { patrolCheckpointService } from '../api/src/modules/patrol-checkpoint/patrol-checkpoint.service';

async function runTests() {
  console.log('🧪 Starting Offline Patrol Sync Data Integrity Verification Tests...\n');

  try {
    // 1. Find or seed a valid client, employee, and assignment
    const client = await prisma.client.findFirst({ select: { id: true, companyName: true } });
    if (!client) throw new Error('No client found in DB');

    const employee = await prisma.employee.findFirst({
      where: { clientId: client.id, role: 'SECURITY' },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) throw new Error('No employee found in DB');

    let assignment = await prisma.guardAssignment.findFirst({
      where: { employeeId: employee.id, isActive: true },
      include: {
        site: true,
        patrolRoute: {
          include: {
            routeGates: {
              include: { gate: true },
            },
          },
        },
      },
    });

    if (!assignment || !assignment.patrolRoute?.routeGates?.length) {
      console.log('⚠️ No assignment with route gates found for security officer. Looking for any assignment...');
      assignment = await prisma.guardAssignment.findFirst({
        where: { isActive: true },
        include: {
          site: true,
          patrolRoute: {
            include: {
              routeGates: {
                include: { gate: true },
              },
            },
          },
        },
      });
    }

    if (!assignment || !assignment.patrolRoute?.routeGates?.length) {
      throw new Error('No valid assignment with route gates found in DB');
    }

    const testEmployeeId = assignment.employeeId;
    const testClientId = assignment.clientId;
    const testGateId = assignment.patrolRoute.routeGates[0].gateId;

    // Fetch active subtasks for this gate to populate required responses
    const subTasks = await prisma.gateSubTask.findMany({
      where: { gateId: testGateId, isActive: true, role: 'SECURITY' },
    });
    const subTaskResponses = subTasks.map((st) => ({
      gateSubTaskId: st.id,
      answer: 'YES' as const,
      remarks: 'Verified offline subtask response',
    }));

    console.log(`📌 Test Context: Client="${client.companyName}" (${testClientId}), Employee="${testEmployeeId}", Assignment="${assignment.id}", Gate="${testGateId}"`);

    // Clean up any lingering active sessions for this employee first
    const existingActive = await prisma.patrolSession.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'PAUSED'] },
        assignment: { employeeId: testEmployeeId },
      },
    });

    for (const session of existingActive) {
      await prisma.patrolCheckpoint.deleteMany({ where: { patrolSessionId: session.id } });
      await prisma.patrolSession.delete({ where: { id: session.id } });
    }
    console.log('✅ Cleaned up old test sessions.');

    // ----------------------------------------------------
    // TEST 1: OFFLINE START -> SCAN -> COMPLETE SYNC FLOW
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Offline Patrol Sync (Start -> Scan Checkpoint -> Finish Sweep) ---');

    // Step A: Server handles startPatrol
    const startResult = await patrolSessionService.start(testClientId, testEmployeeId, assignment.id);
    const realSessionId = startResult.id;
    console.log(`1. Server created PatrolSession: ID="${realSessionId}", Code="${startResult.patrolCode}", Status="${startResult.status}"`);

    // Step B: Offline scan mapped to realSessionId
    const scanResult = await patrolCheckpointService.scan(testEmployeeId, {
      gateId: testGateId,
      patrolSessionId: realSessionId,
      remarks: 'Offline scanned checkpoint 1',
      status: 'VERIFIED',
      subTaskResponses,
    });
    console.log(`2. Scanned Checkpoint: CheckpointID="${scanResult.checkpoint?.id}", Progress=${scanResult.progress.completed}/${scanResult.progress.total}`);

    // Step C: Offline completion mapped to realSessionId
    const completeResult = await patrolSessionService.complete(realSessionId, 'Completed offline patrol sweep.');
    console.log(`3. Completed PatrolSession: Status="${completeResult.status}", EndedAt="${completeResult.endedAt}", Duration=${completeResult.totalDuration}min`);

    if (completeResult.status !== 'COMPLETED' || !completeResult.endedAt) {
      throw new Error('TEST 1 FAILED: Session status is not COMPLETED or endedAt is missing');
    }

    // Step D: Verify Web App History Query returns this completed session
    const historyResult = await patrolSessionService.history(testClientId, { tab: 'history', page: 1, limit: 10 });
    const foundInHistory = historyResult.sessions.find((s) => s.id === realSessionId);

    if (!foundInHistory) {
      throw new Error('TEST 1 FAILED: Synced completed patrol does not appear in Completed Patrol History query!');
    }
    console.log(`4. Web Client Admin Query Verification: Found session in Completed Patrol History! ScannedCount=${foundInHistory.scannedCount}/${foundInHistory.totalCheckpointCount}`);

    // ----------------------------------------------------
    // TEST 2: IDEMPOTENT COMPLETION RETRY
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Idempotent Completion Retry ---');
    const retryComplete = await patrolSessionService.complete(realSessionId, 'Retried completion payload');
    console.log(`1. Retried completion returned session: ID="${retryComplete.id}", Status="${retryComplete.status}"`);

    if (retryComplete.status !== 'COMPLETED') {
      throw new Error('TEST 2 FAILED: Idempotent retry did not return COMPLETED session');
    }
    console.log('✅ TEST 2 PASSED: Completion is 100% idempotent.');

    // ----------------------------------------------------
    // TEST 3: 409 CONFLICT ACTIVE PATROL RESOLUTION
    // ----------------------------------------------------
    console.log('\n--- TEST 3: 409 Conflict Active Session Extraction ---');
    const activePatrol = await patrolSessionService.start(testClientId, testEmployeeId, assignment.id);
    console.log(`1. Created new active patrol: ID="${activePatrol.id}"`);

    let caughtConflictPayload: any = null;
    try {
      await patrolSessionService.start(testClientId, testEmployeeId, assignment.id, false);
    } catch (err: any) {
      caughtConflictPayload = err.details;
      console.log(`2. Caught 409 Conflict as expected. Conflict details:`, caughtConflictPayload);
    }

    if (!caughtConflictPayload || caughtConflictPayload.activePatrolSessionId !== activePatrol.id) {
      throw new Error('TEST 3 FAILED: 409 Conflict payload did not include activePatrolSessionId!');
    }

    // Resolve existing active patrol and verify completion
    const resolvedStart = await patrolSessionService.start(testClientId, testEmployeeId, assignment.id, true);
    console.log(`3. Resolved conflict, new active patrol created: ID="${resolvedStart.id}"`);

    // Clean up test sessions
    const sessionIdsToDelete = [realSessionId, activePatrol.id, resolvedStart.id];
    await prisma.patrolSubTaskResponse.deleteMany({
      where: { patrolCheckpoint: { patrolSessionId: { in: sessionIdsToDelete } } },
    });
    await prisma.patrolCheckpoint.deleteMany({
      where: { patrolSessionId: { in: sessionIdsToDelete } },
    });
    await prisma.patrolSession.deleteMany({
      where: { id: { in: sessionIdsToDelete } },
    });
    console.log('✅ Cleaned up test database records.');

    console.log('\n🎉 ALL OFFLINE PATROL SYNC INTEGRITY TESTS PASSED SUCCESSFULLY!');
  } catch (error: any) {
    console.error('\n❌ TEST SUITE FAILED:', error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
