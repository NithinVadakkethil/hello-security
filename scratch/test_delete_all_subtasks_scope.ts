import { createApp } from '../api/src/bootstrap/app';
import { prisma } from '../api/src/database/prisma';
import { signAccessToken } from '../api/src/common/auth/jwt';
import { UserRole } from '@prisma/client';
import axios from 'axios';
import http from 'http';

async function verifyFullDeleteAllScope() {
  console.log('=== RUNNING COMPREHENSIVE DELETE ALL SUBTASKS SCOPE & SAFETY TEST ===\n');

  const app = createApp();
  const server = http.createServer(app);
  const TEST_PORT = 3098;

  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`[PASS] Test HTTP server listening on http://localhost:${TEST_PORT}`);
      resolve();
    });
  });

  try {
    // 1. Identify Client and User
    const client = await prisma.client.findFirst({
      where: { isActive: true },
      include: {
        sites: {
          include: {
            gates: true,
          },
        },
      },
    });

    if (!client || client.sites.length === 0) {
      throw new Error('No client or site found in local DB');
    }

    const clientId = client.id;
    const site = client.sites[0];

    // Find or pick admin user for token
    let user = await prisma.user.findFirst({
      where: {
        clientId,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER] },
        isActive: true,
      },
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          role: UserRole.SUPER_ADMIN,
          isActive: true,
        },
      });
    }

    if (!user) throw new Error('No admin user found');

    const token = signAccessToken({
      sub: user.id,
      tenantId: clientId,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      supervisedRole: user.supervisedRole || null,
    } as any);

    console.log(`Using Client: "${client.companyName}" (${clientId})`);
    console.log(`Using Admin: "${user.email}" (${user.role})\n`);

    // 2. Ensure test Category, Checkpoints, and Subtasks exist
    console.log('1. Setting up test data across multiple subtask models:');

    // Create a category
    const cat = await prisma.checkpointCategory.create({
      data: {
        clientId,
        name: 'Fire & Safety Test ' + Date.now(),
        normalizedName: 'fire & safety test ' + Date.now(),
      },
    });
    console.log(`   - Created CheckpointCategory: "${cat.name}" (id: ${cat.id})`);

    // Add CategorySubTask
    const catSubTask = await prisma.categorySubTask.create({
      data: {
        categoryId: cat.id,
        role: UserRole.SECURITY,
        taskName: 'Check fire extinguisher pressure gauge',
        isRequired: true,
        displayOrder: 1,
      },
    });
    console.log(`   - Created CategorySubTask: "${catSubTask.taskName}" (id: ${catSubTask.id})`);

    // Create a Gate attached to this category
    const gate1 = await prisma.gate.create({
      data: {
        siteId: site.id,
        gateCode: 'TEST-GATE-01-' + Date.now(),
        name: 'Fire Hose Station 1',
        sequence: 801,
        categoryId: cat.id,
        qrCode: 'QR-TEST-FIRE-01-' + Date.now(),
      },
    });
    console.log(`   - Created Gate 1: "${gate1.name}" (id: ${gate1.id}, code: ${gate1.gateCode}, QR: ${gate1.qrCode})`);

    // Create a Gate attached to no category (legacy style)
    const gate2 = await prisma.gate.create({
      data: {
        siteId: site.id,
        gateCode: 'TEST-GATE-02-' + Date.now(),
        name: 'Perimeter Checkpoint 2',
        sequence: 802,
        categoryId: null,
        qrCode: 'QR-TEST-PERIM-02-' + Date.now(),
      },
    });
    console.log(`   - Created Gate 2: "${gate2.name}" (id: ${gate2.id}, code: ${gate2.gateCode}, QR: ${gate2.qrCode})`);

    // Add legacy GateSubTasks directly on gates
    const gateSubTask1 = await prisma.gateSubTask.create({
      data: {
        gateId: gate1.id,
        role: UserRole.SECURITY,
        taskName: 'Check nozzle seal',
        displayOrder: 1,
      },
    });
    const gateSubTask2 = await prisma.gateSubTask.create({
      data: {
        gateId: gate2.id,
        role: UserRole.SECURITY,
        taskName: 'Check fence integrity',
        displayOrder: 1,
      },
    });
    console.log(`   - Created GateSubTasks: "${gateSubTask1.taskName}", "${gateSubTask2.taskName}"`);

    // Add SubTaskMaster and SubTaskMasterItem for client
    let master = await prisma.subTaskMaster.findFirst({
      where: { clientId, role: UserRole.SECURITY },
    });
    if (!master) {
      master = await prisma.subTaskMaster.create({
        data: {
          clientId,
          role: UserRole.SECURITY,
        },
      });
    }
    const masterItem = await prisma.subTaskMasterItem.create({
      data: {
        masterId: master.id,
        taskName: 'Master template task ' + Date.now(),
        displayOrder: 1,
      },
    });
    console.log(`   - Created SubTaskMasterItem: "${masterItem.taskName}"`);

    // 3. Record Baseline Snapshot Before Deletion
    const baselineSitesCount = await prisma.site.count({ where: { clientId } });
    const baselineGatesCount = await prisma.gate.count({ where: { site: { clientId } } });
    const baselineCatsCount = await prisma.checkpointCategory.count({ where: { clientId } });
    const baselineGate1 = await prisma.gate.findUnique({ where: { id: gate1.id } });
    const baselineGate2 = await prisma.gate.findUnique({ where: { id: gate2.id } });

    console.log('\n2. Baseline Snapshot:');
    console.log(`   - Sites count: ${baselineSitesCount}`);
    console.log(`   - Gates count: ${baselineGatesCount}`);
    console.log(`   - Categories count: ${baselineCatsCount}`);
    console.log(`   - Gate 1 QR: ${baselineGate1?.qrCode}, CategoryId: ${baselineGate1?.categoryId}`);
    console.log(`   - Gate 2 QR: ${baselineGate2?.qrCode}`);

    // 4. Execute DELETE /api/v1/checkpoint-categories/sub-tasks/all
    console.log('\n3. Executing DELETE /api/v1/checkpoint-categories/sub-tasks/all via HTTP:');
    const deleteRes = await axios.delete(`http://localhost:${TEST_PORT}/api/v1/checkpoint-categories/sub-tasks/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`   - HTTP Status: ${deleteRes.status}`);
    console.log(`   - Response Data:`, deleteRes.data);

    if (deleteRes.status !== 200 || !deleteRes.data.success) {
      throw new Error(`DELETE endpoint failed with status ${deleteRes.status}`);
    }

    // 5. Verification Post-Deletion
    console.log('\n4. Verifying Post-Deletion Invariants:');

    // A. Subtask configurations should be 0
    const postCatSubTasksCount = await prisma.categorySubTask.count({
      where: { category: { clientId } },
    });
    const postGateSubTasksCount = await prisma.gateSubTask.count({
      where: { gate: { site: { clientId } } },
    });
    const postMasterItemsCount = await prisma.subTaskMasterItem.count({
      where: { master: { clientId } },
    });

    console.log(`   - CategorySubTask count for client: ${postCatSubTasksCount} (Expected: 0)`);
    console.log(`   - GateSubTask count for client: ${postGateSubTasksCount} (Expected: 0)`);
    console.log(`   - SubTaskMasterItem count for client: ${postMasterItemsCount} (Expected: 0)`);

    if (postCatSubTasksCount !== 0 || postGateSubTasksCount !== 0 || postMasterItemsCount !== 0) {
      throw new Error('Not all subtasks were deleted!');
    }
    console.log('   [PASS] All subtask configuration records were purged cleanly.');

    // B. Categories PRESERVED
    const postCatsCount = await prisma.checkpointCategory.count({ where: { clientId } });
    const verifyCat = await prisma.checkpointCategory.findUnique({ where: { id: cat.id } });
    if (postCatsCount !== baselineCatsCount || !verifyCat) {
      throw new Error('Checkpoint Categories were mutated or deleted!');
    }
    console.log(`   [PASS] Checkpoint Categories PRESERVED: count=${postCatsCount}, "${verifyCat.name}" exists.`);

    // C. Checkpoints (Gates) and QR Codes PRESERVED
    const postGatesCount = await prisma.gate.count({ where: { site: { clientId } } });
    const verifyGate1 = await prisma.gate.findUnique({ where: { id: gate1.id } });
    const verifyGate2 = await prisma.gate.findUnique({ where: { id: gate2.id } });

    if (
      postGatesCount !== baselineGatesCount ||
      !verifyGate1 ||
      !verifyGate2 ||
      verifyGate1.qrCode !== baselineGate1?.qrCode ||
      verifyGate1.categoryId !== baselineGate1?.categoryId ||
      verifyGate2.qrCode !== baselineGate2?.qrCode
    ) {
      throw new Error('Checkpoints or QR codes were mutated or deleted!');
    }
    console.log(`   [PASS] Checkpoints & QR codes PRESERVED: count=${postGatesCount}`);
    console.log(`          Gate 1 ID: ${verifyGate1.id} (SAME), QR: ${verifyGate1.qrCode} (SAME), Category: ${verifyGate1.categoryId} (SAME)`);
    console.log(`          Gate 2 ID: ${verifyGate2.id} (SAME), QR: ${verifyGate2.qrCode} (SAME)`);

    // D. Sites PRESERVED
    const postSitesCount = await prisma.site.count({ where: { clientId } });
    if (postSitesCount !== baselineSitesCount) {
      throw new Error('Sites were mutated!');
    }
    console.log(`   [PASS] Sites PRESERVED: count=${postSitesCount}`);

    // 6. Test Idempotency / Duplicate Execution
    console.log('\n5. Testing Idempotent Second Execution:');
    const deleteRes2 = await axios.delete(`http://localhost:${TEST_PORT}/api/v1/checkpoint-categories/sub-tasks/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`   - Second call HTTP Status: ${deleteRes2.status}`);
    console.log(`   - Second call deletedCount: ${deleteRes2.data.deletedCount}`);
    if (deleteRes2.status !== 200 || deleteRes2.data.deletedCount !== 0) {
      throw new Error('Idempotent second call failed');
    }
    console.log('   [PASS] Idempotency confirmed (returns 200 with deletedCount: 0).');

    // Clean up test gates and category created for this run
    await prisma.gate.deleteMany({
      where: { id: { in: [gate1.id, gate2.id] } },
    });
    await prisma.checkpointCategory.deleteMany({
      where: { id: cat.id },
    });
    console.log('\n[PASS] Temporary test data cleaned up safely.');
    console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    server.close();
  }
}

verifyFullDeleteAllScope()
  .catch((err) => {
    console.error('Test execution error:', err.response?.data || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
