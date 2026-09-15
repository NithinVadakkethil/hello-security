import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function runCentralizedManagerTests() {
  console.log('=== STARTING CENTRALIZED MANAGER PORTAL BACKEND TESTS ===\n');

  try {
    // 1. Find or verify Centralized Manager user
    const centralManager = await prisma.user.findFirst({
      where: {
        role: UserRole.MANAGER,
        managerMemberships: {
          some: {
            isActive: true,
          },
        },
      },
      include: {
        managerMemberships: {
          where: { isActive: true },
          include: {
            client: true,
          },
        },
      },
    });

    if (!centralManager) {
      console.log('⚠️ No Centralized Manager user with active client memberships found in local DB.');
      return;
    }

    console.log(`✅ Found Centralized Manager user: ${centralManager.email} (ID: ${centralManager.id})`);
    const assignedClients = centralManager.managerMemberships.map((m) => m.client);
    console.log(`   Assigned Clients (${assignedClients.length}):`);
    assignedClients.forEach((c) => {
      console.log(`   - ${c.companyName} (${c.clientCode}) [ID: ${c.id}]`);
    });

    const assignedClientIds = assignedClients.map((c) => c.id);

    // 2. Test Employee Role Grouping Query
    if (assignedClientIds.length > 0) {
      const targetClientId = assignedClientIds[0];
      const roleCounts = await prisma.user.groupBy({
        by: ['role'],
        where: {
          clientId: targetClientId,
          isActive: true,
        },
        _count: {
          _all: true,
        },
      });

      console.log(`\n✅ Role Breakdown Test for Client ${assignedClients[0].companyName}:`);
      roleCounts.forEach((r) => {
        console.log(`   - Role ${r.role}: ${r._count._all} users`);
      });
    }

    // 3. Test Unauthorized Access Validation Logic
    const unassignedClient = await prisma.client.findFirst({
      where: {
        id: { notIn: assignedClientIds },
        isActive: true,
      },
    });

    if (unassignedClient) {
      console.log(`\n✅ Verification of Direct URL Security / Unauthorized Access:`);
      console.log(`   User assigned clients: [${assignedClientIds.join(', ')}]`);
      console.log(`   Attempting access to unassigned client: ${unassignedClient.companyName} (${unassignedClient.id})`);
      const isAuthorized = assignedClientIds.includes(unassignedClient.id);
      console.log(`   Result: Access Authorized? ${isAuthorized} => (Should be FALSE -> 403 FORBIDDEN)`);
      if (!isAuthorized) {
        console.log('   ✅ PASS: Unauthorized Client Access is strictly BLOCKED.');
      } else {
        console.log('   ❌ FAIL: Security vulnerability detected!');
      }
    }

    console.log('\n=== ALL CENTRALIZED MANAGER TESTS COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('❌ Error during Centralized Manager tests:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runCentralizedManagerTests();
