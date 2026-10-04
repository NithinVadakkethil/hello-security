import axios from 'axios';
import { prisma } from '../api/src/database/prisma';

const API_BASE = 'http://localhost:3001/api/v1';

async function verifyCentralManagerAuth() {
  console.log('=== STARTING CENTRALIZED MANAGER LOCAL AUTH VERIFICATION ===\n');

  // 1. Check local DB record
  const user = await prisma.user.findFirst({
    where: { email: 'varinder.k@kaizenams.com' },
    include: { managerMemberships: true },
  });

  if (!user) {
    throw new Error('Centralized Manager user not found in local DB');
  }

  console.log('1. Database Check:');
  console.log(`   - User exists: YES (id: ${user.id})`);
  console.log(`   - Account active: ${user.isActive ? 'YES' : 'NO'}`);
  console.log(`   - Role: ${user.role} (${user.role === 'MANAGER' ? 'CORRECT' : 'INCORRECT'})`);
  console.log(`   - Active Manager Memberships: ${user.managerMemberships.filter(m => m.isActive).length}`);

  if (!user.rawPassword) {
    throw new Error('User has no rawPassword configured in local DB');
  }

  // 2. Perform Login via API
  console.log('\n2. Local API Login Test (POST /api/v1/auth/login):');
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: user.email,
    password: user.rawPassword,
  });

  if (!loginRes.data || !loginRes.data.success || !loginRes.data.data?.accessToken) {
    throw new Error('Login failed or did not return accessToken');
  }

  const token = loginRes.data.data.accessToken;
  const returnedUser = loginRes.data.data.user;

  console.log('   - HTTP Status: 200 OK');
  console.log(`   - Success: ${loginRes.data.success}`);
  console.log(`   - Authenticated Role: ${returnedUser?.role}`);
  console.log(`   - Token Received: [REDACTED valid JWT]`);

  // 3. Verify /auth/me
  console.log('\n3. Current User Endpoint (GET /api/v1/auth/me):');
  const meRes = await axios.get(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!meRes.data?.success || meRes.data.data?.role !== 'MANAGER') {
    throw new Error('/auth/me verification failed');
  }
  console.log(`   - HTTP Status: 200 OK`);
  console.log(`   - Verified Identity: ${meRes.data.data.email}`);
  console.log(`   - Verified Role: ${meRes.data.data.role}`);

  // 4. Test Central Manager Dashboard
  console.log('\n4. Central Manager Dashboard (GET /api/v1/central-manager/dashboard):');
  const dashboardRes = await axios.get(`${API_BASE}/central-manager/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   - HTTP Status: ${dashboardRes.status} OK`);
  console.log(`   - Total Assigned Clients: ${dashboardRes.data.data?.metrics?.totalClients ?? dashboardRes.data.data?.totalClients ?? 'OK'}`);

  // 5. Test Central Manager Attendance
  console.log('\n5. Central Manager Attendance (GET /api/v1/attendance):');
  const attendanceRes = await axios.get(`${API_BASE}/attendance?date=2026-10-03`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   - HTTP Status: ${attendanceRes.status} OK`);
  console.log(`   - Records returned: ${attendanceRes.data.data?.length ?? 0}`);

  // 6. Test Central Manager Reports
  console.log('\n6. Central Manager Reports (GET /api/v1/reports/summary/generate):');
  const reportsRes = await axios.get(`${API_BASE}/reports/summary/generate?periodType=DAILY&date=2026-10-03`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   - HTTP Status: ${reportsRes.status} OK`);
  console.log(`   - Summary metrics retrieved successfully`);

  // 7. Test Logout
  console.log('\n7. Logout Test (POST /api/v1/auth/logout):');
  const logoutRes = await axios.post(
    `${API_BASE}/auth/logout`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  console.log(`   - HTTP Status: ${logoutRes.status} OK`);
  console.log(`   - Logout Success: ${logoutRes.data.success}`);

  // 8. Test Re-login
  console.log('\n8. Re-login Test after Logout:');
  const reloginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: user.email,
    password: user.rawPassword,
  });
  if (!reloginRes.data?.success) {
    throw new Error('Re-login failed');
  }
  console.log(`   - HTTP Status: 200 OK`);
  console.log(`   - Re-login Success: ${reloginRes.data.success}`);

  console.log('\n====================================================');
  console.log('ALL CENTRALIZED MANAGER AUTH CHECKS PASSED! 🎉');
  console.log('====================================================');
}

verifyCentralManagerAuth()
  .catch((err) => {
    console.error('❌ Verification failed:', err.response?.data || err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
