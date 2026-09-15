import { prisma } from '../api/src/database/prisma';
import { managerMembershipService } from '../api/src/modules/manager/manager-membership.service';
import { PatrolCheckpointService } from '../api/src/modules/patrol-checkpoint/patrol-checkpoint.service';

async function runTests() {
  console.log('=== STARTING MANAGER MODULE E2E TESTS ===\n');

  // 1. Setup Test Clients
  const clientA = await prisma.client.findFirst({ where: { isActive: true } });
  if (!clientA) {
    throw new Error('No active client found in DB');
  }

  let clientB = await prisma.client.findFirst({
    where: { isActive: true, id: { not: clientA.id } },
  });

  if (!clientB) {
    console.log('Creating dummy Client B for multi-client test...');
    clientB = await prisma.client.create({
      data: {
        clientCode: 'CLI-B-' + Date.now(),
        companyName: 'Client B Facilities',
        email: `clientB_${Date.now()}@test.com`,
      },
    });
  }

  let clientC = await prisma.client.findFirst({
    where: { isActive: true, id: { notIn: [clientA.id, clientB.id] } },
  });

  if (!clientC) {
    clientC = await prisma.client.create({
      data: {
        clientCode: 'CLI-C-' + Date.now(),
        companyName: 'Unassigned Client C',
        email: `clientC_${Date.now()}@test.com`,
      },
    });
  }

  const managerEmail = `global.manager.${Date.now()}@orbit.com`;
  const managerName = 'Global Manager Test';

  console.log(`[Test 1] Enroll Manager in Client A (${clientA.companyName})`);
  const resA = await managerMembershipService.enrollManager(clientA.id, {
    name: managerName,
    email: managerEmail,
  });
  console.log('Result A:', resA);
  if (!resA.isNewUser) throw new Error('Expected new user creation for first enrollment');

  console.log(`\n[Test 2] Enroll Same Email in Client B (${clientB.companyName})`);
  const resB = await managerMembershipService.enrollManager(clientB.id, {
    name: managerName,
    email: managerEmail,
  });
  console.log('Result B:', resB);
  if (resB.isNewUser) throw new Error('Expected existing user account reuse on second enrollment');

  // Verify single User record & 2 Memberships
  const userCount = await prisma.user.count({
    where: { email: { equals: managerEmail, mode: 'insensitive' } },
  });
  console.log('\n[Verification] Global User Count for Email:', userCount);
  if (userCount !== 1) throw new Error(`Expected 1 user account, found ${userCount}`);

  const user = await prisma.user.findFirst({
    where: { email: { equals: managerEmail, mode: 'insensitive' } },
  });
  if (!user) throw new Error('User not found');

  const memberships = await managerMembershipService.getManagerClients(user.id);
  console.log('[Verification] Manager Active Memberships Count:', memberships.length);
  console.log('Memberships:', memberships.map((m) => m.companyName));
  if (memberships.length < 2) throw new Error('Expected at least 2 active client memberships');

  console.log('\n[Test 3] Verify Manager Client Access (Client A & B vs Unassigned Client C)');
  await managerMembershipService.assertManagerClientAccess(user.id, clientA.id);
  console.log('✅ Client A access assertion PASSED');

  await managerMembershipService.assertManagerClientAccess(user.id, clientB.id);
  console.log('✅ Client B access assertion PASSED');

  try {
    await managerMembershipService.assertManagerClientAccess(user.id, clientC.id);
    throw new Error('❌ UNEXPECTED: Client C access should have been rejected');
  } catch (err: any) {
    console.log('✅ Client C access assertion REJECTED as expected:', err.message);
  }

  console.log('\n[Test 4] Manager Checkpoint QR Scan & Role Subtask Validation');
  const gateA = await prisma.gate.findFirst({
    where: { site: { clientId: clientA.id }, isActive: true },
  });

  if (gateA) {
    // Add a MANAGER subtask if none exists
    let managerSubtask = await prisma.gateSubTask.findFirst({
      where: { gateId: gateA.id, role: 'MANAGER', isActive: true },
    });

    if (!managerSubtask) {
      managerSubtask = await prisma.gateSubTask.create({
        data: {
          gateId: gateA.id,
          role: 'MANAGER',
          taskName: 'Verify Site Housekeeping & Security Compliance',
          isRequired: true,
        },
      });
    }

    const checkpointService = new PatrolCheckpointService();
    const scanResult = await checkpointService.scan(user.id, {
      gateId: gateA.id,
      subTaskResponses: [
        {
          gateSubTaskId: managerSubtask.id,
          answer: 'YES',
          remarks: 'Manager inspection clean',
        },
      ],
    });

    console.log('Manager Scan Result:', scanResult);
    console.log('✅ Manager QR Checkpoint scan PASSED');
  } else {
    console.log('No gate found for Client A, skipping scan execution');
  }

  console.log('\n[Test 5] Remove Manager Membership for Client A');
  await managerMembershipService.removeManagerMembership(clientA.id, user.id);

  const remainingMemberships = await managerMembershipService.getManagerClients(user.id);
  console.log('Remaining Memberships after removing Client A:', remainingMemberships.map((m) => m.companyName));
  if (remainingMemberships.some((m) => m.clientId === clientA.id)) {
    throw new Error('Client A should no longer be in manager memberships');
  }
  if (!remainingMemberships.some((m) => m.clientId === clientB.id)) {
    throw new Error('Client B should still remain in manager memberships');
  }
  console.log('✅ Membership removal test PASSED');

  console.log('\n=== ALL MANAGER MODULE E2E TESTS PASSED SUCCESSFULLY! ===');
}

runTests()
  .catch((err) => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
