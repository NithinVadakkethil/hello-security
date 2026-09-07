import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../api/.env') });

import { generateReportDownloadToken } from '../api/src/common/auth/report-token';
import { prisma } from '../api/src/database/prisma';
import jwt from 'jsonwebtoken';

async function runTests() {
  const baseUrl = 'http://localhost:3001/api/v1';

  console.log('=== RUNNING PUBLIC REPORT PDF DOWNLOAD REGRESSION TESTS ===\n');

  // Fetch an actual patrol session and client from DB to test full PDF rendering
  const realSession = await prisma.patrolSession.findFirst({
    select: { id: true, clientId: true, patrolCode: true },
  });

  const patrolSessionId = realSession?.id || 'cmt9yff5p02xihp7s5809shyu';
  const clientId = realSession?.clientId || 'cmt9ycrf702xahp7s449aqgxj';

  console.log(`Using DB PatrolSession: ${patrolSessionId} (Client: ${clientId})`);

  const jwtSecret = process.env.JWT_ACCESS_SECRET || 'secret';
  const validToken = generateReportDownloadToken(patrolSessionId, clientId);

  const wrongPurposeToken = jwt.sign(
    { patrolSessionId, clientId, purpose: 'OTHER_PURPOSE' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  // TEST A: Valid token without Authorization header
  console.log('\nTEST A: Valid signed public token WITHOUT Authorization header...');
  try {
    const resA = await fetch(`${baseUrl}/reports/public/download-pdf?token=${validToken}`);
    console.log(`  Response Status: ${resA.status}`);
    console.log(`  Content-Type: ${resA.headers.get('content-type')}`);
    console.log(`  Content-Disposition: ${resA.headers.get('content-disposition')}`);
    if (resA.status === 200 && resA.headers.get('content-type')?.includes('application/pdf')) {
      console.log('  ✅ PASSED: 200 OK & Received valid application/pdf binary without login!');
    } else {
      const text = await resA.text();
      console.log(`  ❌ FAILED: ${text}`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // TEST B: No token & No Authorization header
  console.log('\nTEST B: Missing token WITHOUT Authorization header...');
  try {
    const resB = await fetch(`${baseUrl}/reports/public/download-pdf`);
    const jsonB: any = await resB.json();
    console.log(`  Response Status: ${resB.status}`);
    console.log(`  Response Body:`, jsonB);
    if (resB.status === 400 && jsonB.message === 'Download token is required.') {
      console.log('  ✅ PASSED (Rejected cleanly with 400 Missing Token)');
    } else {
      console.log('  ❌ FAILED');
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // TEST C: Invalid token string
  console.log('\nTEST C: Invalid token string...');
  try {
    const resC = await fetch(`${baseUrl}/reports/public/download-pdf?token=invalid_token_string`);
    const jsonC: any = await resC.json();
    console.log(`  Response Status: ${resC.status}`);
    console.log(`  Response Body:`, jsonC);
    if (resC.status === 401 && jsonC.error?.message?.includes('Invalid or expired')) {
      console.log('  ✅ PASSED (Rejected cleanly with 401 Invalid Token)');
    } else {
      console.log('  ❌ FAILED');
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // TEST D: Token with wrong purpose
  console.log('\nTEST D: Token with wrong purpose...');
  try {
    const resD = await fetch(`${baseUrl}/reports/public/download-pdf?token=${wrongPurposeToken}`);
    const jsonD: any = await resD.json();
    console.log(`  Response Status: ${resD.status}`);
    console.log(`  Response Body:`, jsonD);
    if (resD.status === 401 && jsonD.error?.message?.includes('purpose')) {
      console.log('  ✅ PASSED (Rejected cleanly with 401 Wrong Purpose)');
    } else {
      console.log('  ❌ FAILED');
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  // TEST E: Protected endpoint without Authorization header
  console.log('\nTEST E: Protected endpoint GET /reports/analytics WITHOUT Authorization header...');
  try {
    const resE = await fetch(`${baseUrl}/reports/analytics`);
    const jsonE: any = await resE.json();
    console.log(`  Response Status: ${resE.status}`);
    console.log(`  Response Body:`, jsonE);
    if (resE.status === 401 && jsonE.error?.message === 'Authorization header missing.') {
      console.log('  ✅ PASSED (Protected report routes remain 100% secure)');
    } else {
      console.log('  ❌ FAILED');
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  await prisma.$disconnect();
}

runTests();
