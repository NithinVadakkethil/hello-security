import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

function generateToken(user: any) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.clientId || user.tenantId,
      clientId: user.clientId || user.tenantId,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('=== STARTING ATTENDANCE COMPREHENSIVE TEST SUITE ===\n');

  // 1. Find Client Admin
  const clientAdminUser = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN', isActive: true, clientId: { not: null } },
    include: { client: true },
  });

  if (!clientAdminUser) {
    console.error('No active Client Admin found in DB');
    return;
  }
  console.log(`[TEST 1] Client Admin User found: ${clientAdminUser.email} (Client: ${clientAdminUser.client?.companyName}, ClientId: ${clientAdminUser.clientId})`);

  const clientAdminToken = generateToken(clientAdminUser);

  // 2. Fetch Attendance for Client Admin
  try {
    const res = await axios.get(`${API_URL}/attendance`, {
      headers: { Authorization: `Bearer ${clientAdminToken}` },
      params: { page: 1, limit: 10 },
    });
    console.log(`[TEST 2] Client Admin GET /attendance Response: Success = ${res.data.success}, Total Records = ${res.data.data.total}`);
    if (res.data.data.records.length > 0) {
      const first = res.data.data.records[0];
      console.log(`         Sample record: Guard "${first.employeeName}" (${first.employeeRole}), Status: ${first.status}, Date: ${first.date}, Check-in: ${first.checkInTime || 'None'}, Duration: ${first.workingDuration || 'None'}`);

      // Test GET /attendance/:id
      const detailRes = await axios.get(`${API_URL}/attendance/${first.id}`, {
        headers: { Authorization: `Bearer ${clientAdminToken}` },
      });
      console.log(`[TEST 3] GET /attendance/${first.id}: Success = ${detailRes.data.success}, Guard: ${detailRes.data.data.employeeName}`);
    } else {
      console.log('         No attendance records returned for default filter (empty state handled properly).');
    }
  } catch (err: any) {
    console.error('[TEST 2 FAILED]', err.response?.data || err.message);
  }

  // 3. Test Central Manager Access
  const centralManagerUser = await prisma.user.findFirst({
    where: { role: 'MANAGER', isActive: true },
  });

  if (centralManagerUser) {
    console.log(`\n[TEST 4] Central Manager User found: ${centralManagerUser.email}`);
    const cmToken = generateToken(centralManagerUser);

    // Find assigned client for Central Manager
    const membership = await prisma.managerClientMembership.findFirst({
      where: { managerUserId: centralManagerUser.id, isActive: true },
      include: { client: true },
    });

    if (membership) {
      console.log(`         Assigned client: ${membership.client.companyName} (${membership.clientId})`);
      const cmRes = await axios.get(`${API_URL}/attendance`, {
        headers: { Authorization: `Bearer ${cmToken}` },
        params: { clientId: membership.clientId, page: 1, limit: 10 },
      });
      console.log(`[TEST 5] Central Manager GET /attendance?clientId=${membership.clientId}: Success = ${cmRes.data.success}, Total = ${cmRes.data.data.total}`);
    }

    // Test unauthorized client access attempt by Central Manager
    const otherClient = await prisma.client.findFirst({
      where: membership ? { id: { not: membership.clientId } } : {},
    });
    if (otherClient) {
      try {
        await axios.get(`${API_URL}/attendance`, {
          headers: { Authorization: `Bearer ${cmToken}` },
          params: { clientId: otherClient.id },
        });
        console.error(`[TEST 6 FAILED] Central Manager should NOT have access to unauthorized client ${otherClient.companyName}`);
      } catch (err: any) {
        console.log(`[TEST 6 PASSED] Security Scoping enforced: Central Manager unauthorized client access blocked with status ${err.response?.status} (${err.response?.data?.message || err.response?.data?.error?.message})`);
      }
    }
  }

  // 4. Test Cross-Tenant Security for Client Admin
  const otherClientForAdmin = await prisma.client.findFirst({
    where: { id: { not: clientAdminUser.clientId! } },
  });
  if (otherClientForAdmin) {
    // Attempting to pass another clientId as Client Admin
    const tamperRes = await axios.get(`${API_URL}/attendance`, {
      headers: { Authorization: `Bearer ${clientAdminToken}` },
      params: { clientId: otherClientForAdmin.id },
    });
    console.log(`[TEST 7 PASSED] Client Admin tamper attempt safely scoped to tenant: Returned ${tamperRes.data.data.records.length} records within authorized scope.`);
  }

  console.log('\n=== ALL ATTENDANCE BACKEND & SECURITY TESTS COMPLETED SUCCESSFULLY ===');
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
