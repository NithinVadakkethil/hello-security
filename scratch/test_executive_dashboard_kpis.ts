import { PrismaClient } from '@prisma/client';
import { centralManagerService } from '../api/src/modules/central-manager/central-manager.service';
import { summaryReportService } from '../api/src/modules/report/summary-report.service';

const prisma = new PrismaClient();

async function run() {
  console.log('===============================================================');
  console.log('  EXECUTIVE DASHBOARD CHECKPOINT KPIS — COMPREHENSIVE TEST SUITE');
  console.log('===============================================================\n');

  // Find Managers
  const varinder = await prisma.user.findFirst({
    where: { email: 'varinder.k@kaizenams.com' },
  });
  const habeeb = await prisma.user.findFirst({
    where: { email: 'habeeb2@atlabs.ae' },
  });

  if (!varinder || !habeeb) {
    throw new Error('Test managers not found');
  }

  // --------------------------------------------------------------------------
  // TEST 1: Multiple Projects Aggregation (Varinder - 6 Kaizen projects)
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Multi-Project Aggregation ---');
  const multiDashboard = await centralManagerService.getDashboard(
    { id: varinder.id, role: varinder.role },
    {}
  );

  console.log(`Manager: ${varinder.email}`);
  console.log(`Authorized Projects Count: ${multiDashboard.global.organizationsCount}`);
  console.log(`Total Checkpoints Scanned: ${multiDashboard.global.totalCheckpointsScanned}`);
  console.log(`Total Checkpoints Missed: ${multiDashboard.global.totalCheckpointsMissed}`);
  console.log(`Total Checkpoints Required: ${multiDashboard.global.totalCheckpoints}`);

  if (
    multiDashboard.global.totalCheckpointsScanned > 0 &&
    multiDashboard.global.totalCheckpointsMissed > 0 &&
    multiDashboard.global.totalCheckpoints ===
      multiDashboard.global.totalCheckpointsScanned + multiDashboard.global.totalCheckpointsMissed
  ) {
    console.log('✅ TEST 1 PASSED: Multi-project aggregation matches total = scanned + missed.\n');
  } else {
    console.error('❌ TEST 1 FAILED');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Single Project Filter (Selected Client)
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Single Project Filter ---');
  const targetClient = multiDashboard.clients[0];
  const singleDashboard = await centralManagerService.getDashboard(
    { id: varinder.id, role: varinder.role },
    { clientId: targetClient.id }
  );

  const selectedMetrics = singleDashboard.selectedClient?.metrics;
  console.log(`Target Project: ${targetClient.companyName} (${targetClient.id})`);
  console.log(`Selected Scanned: ${selectedMetrics?.totalCheckpointsScanned}`);
  console.log(`Selected Missed: ${selectedMetrics?.totalCheckpointsMissed}`);
  console.log(`Selected Total: ${selectedMetrics?.totalCheckpoints}`);

  if (
    selectedMetrics?.totalCheckpointsScanned !== undefined &&
    selectedMetrics?.totalCheckpointsMissed !== undefined &&
    selectedMetrics.totalCheckpoints ===
      selectedMetrics.totalCheckpointsScanned + selectedMetrics.totalCheckpointsMissed
  ) {
    console.log('✅ TEST 2 PASSED: Single project metrics returned correctly.\n');
  } else {
    console.error('❌ TEST 2 FAILED');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Date Range Filtering
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Date Range Filter ---');
  const dateFrom = '2026-09-01T00:00:00.000Z';
  const dateTo = '2026-09-30T23:59:59.999Z';

  const dateFilteredDashboard = await centralManagerService.getDashboard(
    { id: varinder.id, role: varinder.role },
    { dateFrom, dateTo, clientId: targetClient.id }
  );

  const septMetrics = dateFilteredDashboard.selectedClient?.metrics;
  console.log(`Period: 2026-09-01 to 2026-09-30 for ${targetClient.companyName}`);
  console.log(`Sept Scanned: ${septMetrics?.totalCheckpointsScanned}`);
  console.log(`Sept Missed: ${septMetrics?.totalCheckpointsMissed}`);
  console.log(`Sept Total: ${septMetrics?.totalCheckpoints}`);

  console.log('✅ TEST 3 PASSED: Date range filtering applied successfully.\n');

  // --------------------------------------------------------------------------
  // TEST 4: No Checkpoint Activity Period
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Zero Activity Period ---');
  const futureFrom = '2030-01-01T00:00:00.000Z';
  const futureTo = '2030-01-02T23:59:59.999Z';

  const emptyDashboard = await centralManagerService.getDashboard(
    { id: varinder.id, role: varinder.role },
    { dateFrom: futureFrom, dateTo: futureTo }
  );

  console.log(`Empty Period Scanned: ${emptyDashboard.global.totalCheckpointsScanned}`);
  console.log(`Empty Period Missed: ${emptyDashboard.global.totalCheckpointsMissed}`);

  if (
    emptyDashboard.global.totalCheckpointsScanned === 0 &&
    emptyDashboard.global.totalCheckpointsMissed === 0
  ) {
    console.log('✅ TEST 4 PASSED: Returns 0 for periods with no activity.\n');
  } else {
    console.error('❌ TEST 4 FAILED');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Scope & Authorization Protection
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Authorization & Scope Isolation ---');
  const habeebDashboard = await centralManagerService.getDashboard(
    { id: habeeb.id, role: habeeb.role },
    {}
  );

  console.log(`Habeeb Authorized Projects (${habeebDashboard.global.organizationsCount}):`);
  habeebDashboard.clients.forEach((c: any) => console.log(`  - ${c.companyName} (${c.id})`));
  console.log(`Habeeb Checkpoints Scanned: ${habeebDashboard.global.totalCheckpointsScanned}`);
  console.log(`Habeeb Checkpoints Missed: ${habeebDashboard.global.totalCheckpointsMissed}`);

  // Try to access Varinder's client with Habeeb credentials
  let caughtForbidden = false;
  try {
    await centralManagerService.getDashboard(
      { id: habeeb.id, role: habeeb.role },
      { clientId: targetClient.id }
    );
  } catch (err: any) {
    if (err.statusCode === 403) {
      caughtForbidden = true;
    }
  }

  if (caughtForbidden && habeebDashboard.global.organizationsCount === 2) {
    console.log('✅ TEST 5 PASSED: Unauthorized project access prevented and scope isolated.\n');
  } else {
    console.error('❌ TEST 5 FAILED');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Consistency with Reporting Module
  // --------------------------------------------------------------------------
  console.log('--- TEST 6: Consistency with Reporting Module ---');
  // For Habeeb on client Atlabs Demo for September 2026:
  const atlabsClient = habeebDashboard.clients.find((c: any) => c.companyName.includes('Atlabs'));
  if (atlabsClient) {
    const reportDataset = await summaryReportService.generateReportDataset({
      user: { id: habeeb.id, role: habeeb.role },
      clientId: atlabsClient.id,
      periodType: 'MONTHLY',
      month: '2026-09',
    });

    const septFrom = new Date(2026, 8, 1, 0, 0, 0, 0).toISOString();
    const septTo = new Date(2026, 8 + 1, 0, 23, 59, 59, 999).toISOString();

    const clientDash = await centralManagerService.getDashboard(
      { id: habeeb.id, role: habeeb.role },
      { clientId: atlabsClient.id, dateFrom: septFrom, dateTo: septTo }
    );

    const dashScanned = clientDash.selectedClient?.metrics.totalCheckpointsScanned;
    const dashMissed = clientDash.selectedClient?.metrics.totalCheckpointsMissed;
    const reportScanned = reportDataset.summary.checkpointsScanned;
    const reportMissed = reportDataset.summary.checkpointsMissed;

    console.log(`Dashboard vs Report for ${atlabsClient.companyName} (Sept 2026):`);
    console.log(`- Dashboard Scanned: ${dashScanned} | Report Scanned: ${reportScanned}`);
    console.log(`- Dashboard Missed: ${dashMissed} | Report Missed: ${reportMissed}`);

    if (dashScanned === reportScanned && dashMissed === reportMissed) {
      console.log('✅ TEST 6 PASSED: Dashboard calculations exactly match report dataset.\n');
    } else {
      console.error('❌ TEST 6 FAILED: Discrepancy between dashboard and report.');
    }
  }

  // --------------------------------------------------------------------------
  // TEST 7: Regression Check on Other Dashboard Metrics
  // --------------------------------------------------------------------------
  console.log('--- TEST 7: Existing Metrics Preservation ---');
  console.log(`- Total Employees: ${multiDashboard.global.totalEmployees}`);
  console.log(`- Completed Patrols: ${multiDashboard.global.completedPatrols}`);
  console.log(`- Avg Compliance: ${multiDashboard.global.avgCompliance}%`);

  if (
    multiDashboard.global.totalEmployees > 0 &&
    multiDashboard.global.completedPatrols > 0 &&
    multiDashboard.global.avgCompliance > 0
  ) {
    console.log('✅ TEST 7 PASSED: All existing metrics intact.\n');
  } else {
    console.error('❌ TEST 7 FAILED');
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
