import { createApp } from '../api/src/bootstrap/app';
import { signAccessToken } from '../api/src/common/auth/jwt';
import { prisma } from '../api/src/database/prisma';

async function testExpressRouting() {
  console.log('=== TESTING EXPRESS APP ROUTING DIRECTLY ===');

  const app = createApp();
  const server = app.listen(3009, async () => {
    console.log('Test Express server listening on port 3009...');

    const user = await prisma.user.findFirst({
      where: { role: 'CLIENT_ADMIN' },
    });

    if (!user) {
      console.log('No user found');
      server.close();
      return;
    }

    const token = signAccessToken({
      sub: user.id,
      tenantId: user.clientId,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
    });

    const http = require('http');

    const testRoute = (urlPath: string) => {
      return new Promise<void>((resolve) => {
        const options = {
          hostname: 'localhost',
          port: 3009,
          path: urlPath,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };

        const req = http.request(options, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => (data += chunk));
          res.on('end', () => {
            console.log(`\nURL: ${urlPath}`);
            console.log(`STATUS: ${res.statusCode}`);
            console.log(`RESPONSE BODY: ${data.substring(0, 350)}`);
            resolve();
          });
        });

        req.on('error', (e: any) => {
          console.error(`ERROR for ${urlPath}:`, e.message);
          resolve();
        });

        req.end();
      });
    };

    // Test 1: DAILY
    await testRoute('/api/v1/reports/summary/generate?reportType=DAILY&date=2026-10-01');

    // Test 2: WEEKLY
    await testRoute('/api/v1/reports/summary/generate?reportType=WEEKLY&date=2026-10-01');

    // Test 3: MONTHLY (date=2026-09)
    await testRoute('/api/v1/reports/summary/generate?reportType=MONTHLY&date=2026-09');

    // Test 4: PDF
    await testRoute('/api/v1/reports/summary/pdf?reportType=MONTHLY&date=2026-09');

    // Test 5: EXCEL
    await testRoute('/api/v1/reports/summary/excel?reportType=MONTHLY&date=2026-09');

    server.close(() => {
      console.log('\n=== DIRECT ROUTING TEST COMPLETE ===');
      prisma.$disconnect();
    });
  });
}

testExpressRouting();
