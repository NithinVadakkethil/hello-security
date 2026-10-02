import { summaryReportService } from '../api/src/modules/report/summary-report.service';
import { pdfGeneratorService } from '../api/src/modules/report/pdf-generator.service';
import { excelGeneratorService } from '../api/src/modules/report/excel-generator.service';
import { prisma } from '../api/src/database/prisma';

async function testReportingModule() {
  console.log('=== TESTING REPORTING MODULE ===');

  try {
    // Fetch a sample Client Admin user from local DB
    const adminUser = await prisma.user.findFirst({
      where: { role: 'CLIENT_ADMIN' },
      select: { id: true, clientId: true, role: true },
    });

    if (!adminUser || !adminUser.clientId) {
      console.log('No Client Admin user found in local DB. Testing fallback params...');
    }

    const clientId = adminUser?.clientId || 'sample-client-id';

    console.log(`Generating DAILY report dataset for clientId: ${clientId}...`);
    const dataset = await summaryReportService.generateReportDataset({
      periodType: 'DAILY',
      date: '2026-10-01',
      clientId,
      user: {
        id: adminUser?.id || 'admin-id',
        role: adminUser?.role || 'CLIENT_ADMIN',
        clientId,
      },
    });

    console.log('Report Dataset generated successfully:');
    console.log('- Metadata:', dataset.metadata);
    console.log('- Executive Summary:', dataset.summary);
    console.log(`- Attendance Count: ${dataset.attendance.length}`);
    console.log(`- Patrol Sessions Count: ${dataset.patrols.length}`);
    console.log(`- Mandatory Patrols Count: ${dataset.mandatoryPatrols.length}`);
    console.log(`- Checkpoints Count: ${dataset.checkpoints.length}`);
    console.log(`- Incidents Count: ${dataset.incidents.length}`);
    console.log(`- Site Summary Rows: ${dataset.siteSummary.length}`);
    console.log(`- Employee Summary Rows: ${dataset.employeeSummary.length}`);

    console.log('\nTesting Excel Generation...');
    const excelBuffer = excelGeneratorService.generateExcel(dataset);
    console.log(`Excel Workbook generated successfully! Buffer length: ${excelBuffer.length} bytes`);

    console.log('\nTesting PDF Generation (Puppeteer)...');
    const pdfBuffer = await pdfGeneratorService.generatePdf(dataset);
    console.log(`PDF Document generated successfully! Buffer length: ${pdfBuffer.length} bytes`);

    console.log('\n=== ALL REPORTING MODULE TESTS PASSED PERFECTLY! ===');
  } catch (err: any) {
    console.error('TEST ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testReportingModule();
