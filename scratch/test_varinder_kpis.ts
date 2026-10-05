import { PrismaClient } from '@prisma/client';
import { centralManagerService } from '../api/src/modules/central-manager/central-manager.service';

const prisma = new PrismaClient();

async function run() {
  const cmUser = await prisma.user.findFirst({
    where: { email: 'varinder.k@kaizenams.com' },
  });

  if (!cmUser) {
    console.log('User not found');
    return;
  }

  console.log(`Testing with Varinder (${cmUser.email})`);

  // Global overview across 6 projects
  const dashboard = await centralManagerService.getDashboard(
    { id: cmUser.id, role: cmUser.role },
    {}
  );

  console.log('\nGlobal Multi-Project Dashboard (6 Kaizen projects):');
  console.log(`- Projects: ${dashboard.global.organizationsCount}`);
  console.log(`- Total Checkpoints Scanned: ${dashboard.global.totalCheckpointsScanned}`);
  console.log(`- Total Checkpoints Missed: ${dashboard.global.totalCheckpointsMissed}`);
  console.log(`- Total Required: ${dashboard.global.totalCheckpoints}`);

  // Test single client filter
  if (dashboard.clients.length > 0) {
    const singleClient = dashboard.clients[0];
    const filteredDashboard = await centralManagerService.getDashboard(
      { id: cmUser.id, role: cmUser.role },
      { clientId: singleClient.id }
    );
    console.log(`\nFiltered to Single Client: ${singleClient.companyName} (${singleClient.id})`);
    console.log(`- Selected Checkpoints Scanned: ${filteredDashboard.selectedClient?.metrics.totalCheckpointsScanned}`);
    console.log(`- Selected Checkpoints Missed: ${filteredDashboard.selectedClient?.metrics.totalCheckpointsMissed}`);
    console.log(`- Selected Checkpoints Total: ${filteredDashboard.selectedClient?.metrics.totalCheckpoints}`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
