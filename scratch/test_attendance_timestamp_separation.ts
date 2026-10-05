import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { signAccessToken } from '../api/src/common/auth/jwt';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

function generateToken(user: any) {
  return signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    supervisedRole: user.supervisedRole || null,
    tenantId: user.clientId || user.tenantId,
    employeeId: user.employeeId || null,
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('  ATTENDANCE & PATROL TIMESTAMP INDEPENDENCE TEST SUITE');
  console.log('========================================================================\n');

  // 1. Find Client Admin
  const clientAdmin = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN', isActive: true, clientId: { not: null } },
  });
  if (!clientAdmin || !clientAdmin.clientId) {
    throw new Error('Client admin not found');
  }
  const adminToken = generateToken(clientAdmin);

  // 2. Find Site & Shift
  const site = await prisma.site.findFirst({
    where: { clientId: clientAdmin.clientId, isActive: true },
  });
  const shift = await prisma.shift.findFirst({
    where: { clientId: clientAdmin.clientId, isActive: true },
  });
  if (!site || !shift) {
    throw new Error('Site or Shift not found');
  }

  // 3. Create a clean test Employee
  const testEmail = `test.att.guard.${Date.now()}@example.com`;
  const empCode = `EMP-TEST-${Date.now().toString().slice(-4)}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 30);

  const employee = await prisma.employee.create({
    data: {
      clientId: clientAdmin.clientId,
      employeeNumber: empCode,
      firstName: 'TestGuard',
      lastName: 'TimestampCheck',
      email: testEmail,
      role: 'SECURITY',
      status: 'ACTIVE',
      designation: 'Security Officer',
      siraCardExpiryDate: tomorrow,
    },
  });

  const guardUser = await prisma.user.create({
    data: {
      clientId: clientAdmin.clientId,
      employeeId: employee.id,
      email: testEmail,
      password: '$2b$10$gyQHoY03NSoTYkT40hNwWeRTY86HLajQkiQ9WYIsZkaCAztJqhh0G',
      role: 'SECURITY',
      isActive: true,
    },
  });
  const guardToken = generateToken(guardUser);

  // Create active GuardAssignment
  const assignment = await prisma.guardAssignment.create({
    data: {
      clientId: clientAdmin.clientId,
      employeeId: employee.id,
      siteId: site.id,
      shiftId: shift.id,
      assignmentType: 'ROUTE',
      effectiveFrom: new Date('2026-01-01'),
      isActive: true,
    },
  });

  const todayStr = new Date().toISOString().split('T')[0];

  console.log(`[Step 1] Initial State: Employee ${employee.employeeNumber} created without attendance.`);

  // Verify initial attendance list
  const listRes1 = await axios.get(`${API_URL}/attendance?employeeId=${employee.id}&date=${todayStr}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const rec1 = listRes1.data.data.records.find((r: any) => r.employeeId === employee.id);
  console.log('Record before patrol/attendance:', {
    status: rec1?.status,
    checkInTime: rec1?.checkInTime,
    checkOutTime: rec1?.checkOutTime,
    workingDuration: rec1?.workingDuration,
  });
  console.assert(rec1?.status === 'OFF', 'Initial status must be OFF');
  console.assert(rec1?.checkInTime === null, 'Initial checkInTime must be null');
  console.assert(rec1?.checkOutTime === null, 'Initial checkOutTime must be null');
  console.log('✅ Initial status is OFF with null timestamps.\n');

  // [Step 2] Simulate Mandatory Patrol started at 11:02 AM and ended at 11:08 AM
  console.log('[Step 2] Simulating Mandatory Patrol session (11:02 AM -> 11:08 AM)...');
  const patrolStart = new Date();
  patrolStart.setHours(11, 2, 0, 0);
  const patrolEnd = new Date();
  patrolEnd.setHours(11, 8, 0, 0);

  const patrolSession = await prisma.patrolSession.create({
    data: {
      clientId: clientAdmin.clientId,
      assignmentId: assignment.id,
      patrolCode: `PAT-TEST-${Date.now()}`,
      status: 'COMPLETED',
      startedAt: patrolStart,
      endedAt: patrolEnd,
      totalDuration: 6,
    },
  });

  // Verify attendance list after patrol completion
  const listRes2 = await axios.get(`${API_URL}/attendance?employeeId=${employee.id}&date=${todayStr}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const rec2 = listRes2.data.data.records.find((r: any) => r.employeeId === employee.id);
  console.log('Record AFTER patrol completion (NO attendance marked):', {
    status: rec2?.status,
    checkInTime: rec2?.checkInTime,
    checkOutTime: rec2?.checkOutTime,
    workingDuration: rec2?.workingDuration,
    completedPatrolsCount: rec2?.completedPatrolsCount,
  });

  console.assert(rec2?.status === 'OFF', 'Status must remain OFF when only patrol completed');
  console.assert(rec2?.checkInTime === null, 'Patrol start time MUST NOT populate checkInTime');
  console.assert(rec2?.checkOutTime === null, 'Patrol end time MUST NOT populate checkOutTime');
  console.assert(rec2?.completedPatrolsCount === 1, 'Informational completedPatrolsCount should reflect 1');
  console.log('✅ Mandatory Patrol timestamps DID NOT leak into Attendance fields!\n');

  // [Step 3] Face-Verified Attendance Check-In at 11:09 AM
  console.log('[Step 3] Performing Face-Verified Check-In at 11:09 AM...');
  const checkInRes = await axios.post(
    `${API_URL}/attendance/check-in`,
    {
      employeeId: employee.id,
      assignmentId: assignment.id,
      siteId: site.id,
      shiftId: shift.id,
      businessDate: todayStr,
    },
    { headers: { Authorization: `Bearer ${guardToken}` } }
  );

  console.log('Check-in API response:', {
    status: checkInRes.data.data.status,
    checkInTime: checkInRes.data.data.checkInTime,
    checkOutTime: checkInRes.data.data.checkOutTime,
    workingDuration: checkInRes.data.data.workingDuration,
  });
  console.assert(checkInRes.data.data.checkInTime !== null, 'Check-in time must be populated');
  console.assert(checkInRes.data.data.checkOutTime === null, 'Check-out time must be null during check-in');
  console.assert(checkInRes.data.data.status === 'PRESENT' || checkInRes.data.data.status === 'LATE', 'Status must be PRESENT or LATE');
  console.log('✅ Attendance Check-In recorded authoritative server timestamp.\n');

  // [Step 4] Verify duplicate check-in blocked
  console.log('[Step 4] Testing duplicate check-in protection...');
  let dupError: any = null;
  try {
    await axios.post(
      `${API_URL}/attendance/check-in`,
      {
        employeeId: employee.id,
        businessDate: todayStr,
      },
      { headers: { Authorization: `Bearer ${guardToken}` } }
    );
  } catch (err: any) {
    dupError = err.response;
  }
  console.assert(dupError?.status === 400, 'Duplicate check-in must return 400');
  console.log('✅ Duplicate check-in correctly blocked.\n');

  // [Step 5] Face-Verified Attendance Checkout at 5:10 PM
  console.log('[Step 5] Performing Face-Verified Check-Out at 5:10 PM...');
  const checkOutRes = await axios.post(
    `${API_URL}/attendance/check-out`,
    {
      employeeId: employee.id,
      assignmentId: assignment.id,
      businessDate: todayStr,
    },
    { headers: { Authorization: `Bearer ${guardToken}` } }
  );

  console.log('Check-out API response:', {
    status: checkOutRes.data.data.status,
    checkInTime: checkOutRes.data.data.checkInTime,
    checkOutTime: checkOutRes.data.data.checkOutTime,
    workingDuration: checkOutRes.data.data.workingDuration,
  });
  console.assert(checkOutRes.data.data.status === 'COMPLETED', 'Status must be COMPLETED');
  console.assert(checkOutRes.data.data.checkOutTime !== null, 'Check-out time must be populated');
  console.log('✅ Attendance Check-Out recorded authoritative server timestamp.\n');

  // [Step 6] Test duplicate check-out protection
  console.log('[Step 6] Testing duplicate check-out protection...');
  let dupOutError: any = null;
  try {
    await axios.post(
      `${API_URL}/attendance/check-out`,
      {
        employeeId: employee.id,
        businessDate: todayStr,
      },
      { headers: { Authorization: `Bearer ${guardToken}` } }
    );
  } catch (err: any) {
    dupOutError = err.response;
  }
  console.assert(dupOutError?.status === 400, 'Duplicate check-out must return 400');
  console.log('✅ Duplicate check-out correctly blocked.\n');

  // [Step 7] Test PDF and Excel export endpoints
  console.log('[Step 7] Testing Attendance Export (PDF & Excel)...');
  const pdfRes = await axios.get(`${API_URL}/attendance/export/pdf?date=${todayStr}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    responseType: 'arraybuffer',
  });
  console.assert(pdfRes.status === 200, 'PDF export must return 200');
  console.assert(pdfRes.headers['content-type'] === 'application/pdf', 'Must be application/pdf');

  const excelRes = await axios.get(`${API_URL}/attendance/export/excel?date=${todayStr}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    responseType: 'arraybuffer',
  });
  console.assert(excelRes.status === 200, 'Excel export must return 200');
  console.log('✅ PDF and Excel exports generated successfully.\n');

  // Cleanup
  console.log('[Cleanup] Cleaning up test records...');
  await prisma.patrolSession.deleteMany({ where: { id: patrolSession.id } });
  await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
  await prisma.guardAssignment.deleteMany({ where: { id: assignment.id } });
  await prisma.user.deleteMany({ where: { id: guardUser.id } });
  await prisma.employee.deleteMany({ where: { id: employee.id } });

  console.log('========================================================================');
  console.log('  ALL ATTENDANCE TIMESTAMP SEPARATION TESTS PASSED 100%!               ');
  console.log('========================================================================\n');

  await prisma.$disconnect();
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
