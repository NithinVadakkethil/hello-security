import { PrismaClient } from '@prisma/client';
import { centralManagerService } from '../api/src/modules/central-manager/central-manager.service';
import { summaryReportService } from '../api/src/modules/report/summary-report.service';

const prisma = new PrismaClient();

async function run() {
  console.log('=== VERIFYING CENTRAL MANAGER CHECKPOINT KPIS ===\n');

  const cmUser = await prisma.user.findFirst({
    where: {
      role: 'MANAGER',
      isActive: true,
      managerMemberships: { some: { isActive: true } },
    },
  });

  if (!cmUser) {
    console.log('No Centralized Manager found');
    return;
  }

  console.log(`Testing with Centralized Manager: ${cmUser.email} (ID: ${cmUser.id})`);

  // Test 1: Global Dashboard
  const dashboard = await centralManagerService.getDashboard(
    { id: cmUser.id, role: cmUser.role },
    { dateFrom: undefined, dateTo: undefined }
  );

  console.log('\nGlobal Dashboard Data:');
  console.log(JSON.stringify(dashboard.global, null, 2));

  if (dashboard.selectedClient) {
    console.log(`\nSelected Client: ${dashboard.selectedClient.companyName} (${dashboard.selectedClient.id})`);
    console.log('Selected Client Metrics:', JSON.stringify(dashboard.selectedClient.metrics, null, 2));

    // Compare with summary report for this client
    const now = new Date();
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const report = await summaryReportService.generateReportDataset({
      user: { id: cmUser.id, role: cmUser.role },
      clientId: dashboard.selectedClient.id,
      periodType: 'MONTHLY',
      date: now.toISOString().split('T')[0],
    });

    console.log('\nSummary Report Checkpoints for Current Month:');
    console.log(`- Scanned: ${report.summary.checkpointsScanned}`);
    console.log(`- Missed: ${report.summary.checkpointsMissed}`);
    console.log(`- Total: ${report.summary.totalCheckpoints}`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
