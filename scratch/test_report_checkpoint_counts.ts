import { PrismaClient } from '@prisma/client';
import { summaryReportService } from '../api/src/modules/report/summary-report.service';

const prisma = new PrismaClient();

async function run() {
  const cmUser = await prisma.user.findFirst({
    where: { role: 'MANAGER', isActive: true, managerMemberships: { some: { isActive: true } } },
  });
  if (!cmUser) return;

  const latestSession = await prisma.patrolSession.findFirst({
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true, clientId: true, client: { select: { companyName: true } } },
  });

  console.log('Latest patrol session:', latestSession);

  if (latestSession) {
    const reportDate = latestSession.startedAt.toISOString().split('T')[0];
    const report = await summaryReportService.generateReportDataset({
      user: { id: cmUser.id, role: cmUser.role },
      clientId: latestSession.clientId,
      periodType: 'DAILY',
      date: reportDate,
    });

    console.log(`\nSummary Report on ${reportDate} for ${latestSession.client?.companyName}:`);
    console.log(`- Scanned: ${report.summary.checkpointsScanned}`);
    console.log(`- Missed: ${report.summary.checkpointsMissed}`);
    console.log(`- Total Required: ${report.summary.totalCheckpoints}`);
    console.log(`- Completion %: ${report.summary.checkpointCompletionPct}%`);

    const monthlyReport = await summaryReportService.generateReportDataset({
      user: { id: cmUser.id, role: cmUser.role },
      clientId: latestSession.clientId,
      periodType: 'MONTHLY',
      date: reportDate,
    });

    console.log(`\nMonthly Summary Report for ${latestSession.client?.companyName}:`);
    console.log(`- Scanned: ${monthlyReport.summary.checkpointsScanned}`);
    console.log(`- Missed: ${monthlyReport.summary.checkpointsMissed}`);
    console.log(`- Total Required: ${monthlyReport.summary.totalCheckpoints}`);
    console.log(`- Completion %: ${monthlyReport.summary.checkpointCompletionPct}%`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
