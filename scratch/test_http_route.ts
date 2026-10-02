import http from 'http';
import { prisma } from '../api/src/database/prisma';
import { signAccessToken } from '../api/src/common/auth/jwt';

async function testHttpRoute() {
  const user = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN' },
  });

  if (!user) {
    console.log('No user found');
    return;
  }

  const token = signAccessToken({
    sub: user.id,
    tenantId: user.clientId,
    employeeId: user.employeeId,
    email: user.email,
    role: user.role,
  });

  console.log('Generated token for user:', user.email);

  // Test port 3001
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/reports/summary/generate?reportType=MONTHLY&date=2026-09',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    console.log('STATUS PORT 3001:', res.statusCode);
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      console.log('RESPONSE PORT 3001:', data.substring(0, 500));
    });
  });

  req.on('error', (e) => {
    console.error('PORT 3001 ERROR:', e.message);
  });

  req.end();
}

testHttpRoute();
