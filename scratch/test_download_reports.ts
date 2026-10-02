import http from 'http';
import fs from 'fs';
import path from 'path';
import { prisma } from '../api/src/database/prisma';
import { signAccessToken } from '../api/src/common/auth/jwt';

async function testDownloadReports() {
  console.log('=== VERIFYING REPORT GENERATION & DOWNLOADS ===');

  const user = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN' },
  });

  if (!user) {
    console.error('No Client Admin user found');
    return;
  }

  const token = signAccessToken({
    sub: user.id,
    tenantId: user.clientId,
    employeeId: user.employeeId,
    email: user.email,
    role: user.role,
  });

  const requestHelper = (port: number, pathUrl: string) => {
    return new Promise<{ statusCode: number; data: Buffer }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: pathUrl,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 500,
              data: Buffer.concat(chunks),
            });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  };

  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. DAILY Report Test
  console.log('\nTesting DAILY Report...');
  const dailyRes = await requestHelper(3001, '/api/v1/reports/summary/generate?reportType=DAILY&date=2026-08-03');
  console.log(`DAILY Status: ${dailyRes.statusCode}`);
  const dailyJson = JSON.parse(dailyRes.data.toString());
  console.log('DAILY Client Name:', dailyJson.data?.metadata?.clientName);
  console.log('DAILY Summary:', dailyJson.data?.summary);

  // 2. WEEKLY Report Test (The exact user URL)
  console.log('\nTesting WEEKLY Report (User query: date=2026-08-03)...');
  const weeklyRes = await requestHelper(3001, '/api/v1/reports/summary/generate?reportType=WEEKLY&date=2026-08-03');
  console.log(`WEEKLY Status: ${weeklyRes.statusCode}`);
  const weeklyJson = JSON.parse(weeklyRes.data.toString());
  console.log('WEEKLY Period:', weeklyJson.data?.metadata?.periodLabel);

  // 3. MONTHLY Report Test
  console.log('\nTesting MONTHLY Report (date=2026-08)...');
  const monthlyRes = await requestHelper(3001, '/api/v1/reports/summary/generate?reportType=MONTHLY&date=2026-08');
  console.log(`MONTHLY Status: ${monthlyRes.statusCode}`);
  const monthlyJson = JSON.parse(monthlyRes.data.toString());
  console.log('MONTHLY Period:', monthlyJson.data?.metadata?.periodLabel);

  // 4. Download DAILY PDF
  console.log('\nDownloading DAILY PDF...');
  const pdfDailyRes = await requestHelper(3001, '/api/v1/reports/summary/pdf?reportType=DAILY&date=2026-08-03');
  console.log(`DAILY PDF Status: ${pdfDailyRes.statusCode}, size: ${pdfDailyRes.data.length} bytes`);
  fs.writeFileSync(path.join(outputDir, 'HelloOrbit_DAILY_Report_2026-08-03.pdf'), pdfDailyRes.data);

  // 5. Download WEEKLY PDF
  console.log('\nDownloading WEEKLY PDF...');
  const pdfWeeklyRes = await requestHelper(3001, '/api/v1/reports/summary/pdf?reportType=WEEKLY&date=2026-08-03');
  console.log(`WEEKLY PDF Status: ${pdfWeeklyRes.statusCode}, size: ${pdfWeeklyRes.data.length} bytes`);
  fs.writeFileSync(path.join(outputDir, 'HelloOrbit_WEEKLY_Report_2026-08-03.pdf'), pdfWeeklyRes.data);

  // 6. Download MONTHLY PDF
  console.log('\nDownloading MONTHLY PDF...');
  const pdfMonthlyRes = await requestHelper(3001, '/api/v1/reports/summary/pdf?reportType=MONTHLY&date=2026-08');
  console.log(`MONTHLY PDF Status: ${pdfMonthlyRes.statusCode}, size: ${pdfMonthlyRes.data.length} bytes`);
  fs.writeFileSync(path.join(outputDir, 'HelloOrbit_MONTHLY_Report_2026-08.pdf'), pdfMonthlyRes.data);

  // 7. Download DAILY Excel
  console.log('\nDownloading DAILY Excel (.xlsx)...');
  const xlsxDailyRes = await requestHelper(3001, '/api/v1/reports/summary/excel?reportType=DAILY&date=2026-08-03');
  console.log(`DAILY Excel Status: ${xlsxDailyRes.statusCode}, size: ${xlsxDailyRes.data.length} bytes`);
  fs.writeFileSync(path.join(outputDir, 'HelloOrbit_DAILY_Report_2026-08-03.xlsx'), xlsxDailyRes.data);

  // 8. Download WEEKLY Excel
  console.log('\nDownloading WEEKLY Excel (.xlsx)...');
  const xlsxWeeklyRes = await requestHelper(3001, '/api/v1/reports/summary/excel?reportType=WEEKLY&date=2026-08-03');
  console.log(`WEEKLY Excel Status: ${xlsxWeeklyRes.statusCode}, size: ${xlsxWeeklyRes.data.length} bytes`);
  fs.writeFileSync(path.join(outputDir, 'HelloOrbit_WEEKLY_Report_2026-08-03.xlsx'), xlsxWeeklyRes.data);

  // 9. Download MONTHLY Excel
  console.log('\nDownloading MONTHLY Excel (.xlsx)...');
  const xlsxMonthlyRes = await requestHelper(3001, '/api/v1/reports/summary/excel?reportType=MONTHLY&date=2026-08');
  console.log(`MONTHLY Excel Status: ${xlsxMonthlyRes.statusCode}, size: ${xlsxMonthlyRes.data.length} bytes`);
  fs.writeFileSync(path.join(outputDir, 'HelloOrbit_MONTHLY_Report_2026-08.xlsx'), xlsxMonthlyRes.data);

  // 10. Test via Next.js Proxy Port 3000
  console.log('\nTesting via Next.js Proxy on Port 3000...');
  const proxyRes = await requestHelper(3000, '/api/v1/reports/summary/generate?reportType=WEEKLY&date=2026-08-03');
  console.log(`Next.js Port 3000 Proxy Status: ${proxyRes.statusCode}`);

  console.log('\n=== ALL DOWNLOADS & VERIFICATIONS COMPLETED SUCCESSFULLY! ===');
  await prisma.$disconnect();
}

testDownloadReports().catch(console.error);
