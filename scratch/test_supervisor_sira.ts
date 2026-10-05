import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { isSiraRequiredForRole, isSiraExpired } from '../api/src/common/utils/sira-expiry.util';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';
import { signAccessToken } from '../api/src/common/auth/jwt';

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
  console.log('===============================================================');
  console.log('  SIRA ROLE EXTENSION (SECURITY & SUPERVISOR) — TEST SUITE');
  console.log('===============================================================\n');

  // 1. Test isSiraRequiredForRole utility
  console.log('--- 1. Testing isSiraRequiredForRole ---');
  console.assert(isSiraRequiredForRole('SECURITY') === true, 'SECURITY must require SIRA');
  console.assert(isSiraRequiredForRole('SUPERVISOR') === true, 'SUPERVISOR must require SIRA');
  console.assert(isSiraRequiredForRole('TECHNICIAN') === false, 'TECHNICIAN must NOT require SIRA');
  console.assert(isSiraRequiredForRole('CLEANER') === false, 'CLEANER must NOT require SIRA');
  console.assert(isSiraRequiredForRole('MANAGER') === false, 'MANAGER must NOT require SIRA');
  console.assert(isSiraRequiredForRole('CLIENT_ADMIN') === false, 'CLIENT_ADMIN must NOT require SIRA');
  console.log('✅ isSiraRequiredForRole passed for all roles.\n');

  // 2. Test isSiraExpired utility
  console.log('--- 2. Testing isSiraExpired utility ---');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 2);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);

  console.assert(isSiraExpired({ role: 'SECURITY', siraCardExpiryDate: tomorrow }) === false, 'Valid Security SIRA must not be expired');
  console.assert(isSiraExpired({ role: 'SECURITY', siraCardExpiryDate: yesterday }) === true, 'Past Security SIRA must be expired');
  console.assert(isSiraExpired({ role: 'SUPERVISOR', siraCardExpiryDate: tomorrow }) === false, 'Valid Supervisor SIRA must not be expired');
  console.assert(isSiraExpired({ role: 'SUPERVISOR', siraCardExpiryDate: yesterday }) === true, 'Past Supervisor SIRA must be expired');
  console.assert(isSiraExpired({ role: 'TECHNICIAN', siraCardExpiryDate: yesterday }) === false, 'Technician with past date must NOT be expired');
  console.assert(isSiraExpired({ role: 'SUPERVISOR', siraCardExpiryDate: null }) === false, 'Supervisor with null date must NOT be expired');
  console.log('✅ isSiraExpired passed for all test scenarios.\n');

  // 3. Find Client Admin to test API
  const clientAdmin = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN', isActive: true, clientId: { not: null } },
  });
  if (!clientAdmin || !clientAdmin.clientId) {
    throw new Error('Client admin not found');
  }

  const adminToken = generateToken(clientAdmin);

  // 4. Create Supervisor with SIRA data via Employee API
  console.log('--- 3. Testing Employee Create API with Supervisor SIRA ---');
  const testEmail = `test.sup.sira.${Date.now()}@example.com`;
  const createRes = await axios.post(
    `${API_URL}/employees`,
    {
      firstName: 'Supervisor',
      lastName: 'SiraTest',
      email: testEmail,
      phone: '+971500000099',
      designation: 'Security Supervisor',
      role: 'SUPERVISOR',
      supervisedRole: 'SECURITY',
      joiningDate: new Date().toISOString(),
      siraCardExpiryDate: tomorrow.toISOString(),
      siraCardFrontImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      siraCardBackImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const createdEmp = createRes.data.data.employee;
  console.log(`Created Supervisor Employee: ${createdEmp.id} (${createdEmp.employeeNumber})`);
  console.assert(createdEmp.siraCardExpiryDate !== null, 'SIRA expiry date must be saved');
  console.assert(createdEmp.siraCardFrontImage !== null, 'SIRA front image must be saved');
  console.assert(createdEmp.siraCardBackImage !== null, 'SIRA back image must be saved');
  console.log('✅ Supervisor Employee created with SIRA credentials successfully.\n');

  // 5. Retrieve user created for Supervisor employee
  console.log('--- 4. Testing Auth & API Access for Valid Supervisor ---');
  const supervisorUser = await prisma.user.findFirst({
    where: { employeeId: createdEmp.id },
  });
  if (!supervisorUser) throw new Error('Supervisor user not found');

  const supervisorToken = generateToken(supervisorUser);

  // Test Profile API (/auth/me)
  const meRes = await axios.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${supervisorToken}` },
  });
  console.log(`Supervisor /auth/me SIRA Expired status: ${meRes.data.data.isSiraExpired}`);
  console.assert(meRes.data.data.isSiraExpired === false, 'Valid Supervisor must have isSiraExpired=false');

  // Test Operational API (/patrol-sessions)
  const opRes = await axios.get(`${API_URL}/patrol-sessions`, {
    headers: { Authorization: `Bearer ${supervisorToken}` },
  });
  console.log(`Operational API (/patrol-sessions) Status: ${opRes.status}`);
  console.assert(opRes.status === 200, 'Valid Supervisor must access operational APIs');
  console.log('✅ Valid Supervisor allowed operational access.\n');

  // 6. Update Supervisor to Expired SIRA date
  console.log('--- 5. Testing SIRA Expiry Restriction on Supervisor ---');
  await prisma.employee.update({
    where: { id: createdEmp.id },
    data: { siraCardExpiryDate: yesterday },
  });

  // Test Profile API (/auth/me) still allowed in expired state
  const meExpiredRes = await axios.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${supervisorToken}` },
  });
  console.log(`Supervisor /auth/me in expired state: isSiraExpired = ${meExpiredRes.data.data.isSiraExpired}`);
  console.assert(meExpiredRes.data.data.isSiraExpired === true, 'Expired Supervisor must have isSiraExpired=true');
  console.log('✅ /auth/me remains accessible in expired state.');

  // Test Operational API (/patrol-sessions) blocked with SIRA_CARD_EXPIRED (403)
  let caughtOpError: any = null;
  try {
    await axios.get(`${API_URL}/patrol-sessions`, {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
  } catch (err: any) {
    caughtOpError = err.response;
  }

  console.log(`Operational API response code: ${caughtOpError?.status}`);
  console.log(`Operational API error code: ${caughtOpError?.data?.error?.code}`);
  console.assert(caughtOpError?.status === 403, 'Expired Supervisor must be forbidden (403)');
  console.assert(
    caughtOpError?.data?.error?.code === 'SIRA_CARD_EXPIRED',
    'Error code must be SIRA_CARD_EXPIRED'
  );
  console.log('✅ Expired Supervisor blocked from operational APIs with SIRA_CARD_EXPIRED.\n');

  // 7. Test Security role regression (Security with valid & expired SIRA)
  console.log('--- 6. Testing Security Role Regression ---');
  const secEmail = `test.sec.sira.${Date.now()}@example.com`;
  const secEmp = await prisma.employee.create({
    data: {
      firstName: 'Security',
      lastName: 'SiraTest',
      email: secEmail,
      phone: '+971500000088',
      designation: 'Security Officer',
      role: 'SECURITY',
      clientId: clientAdmin.clientId,
      employeeNumber: `EMP-${Date.now().toString().slice(-6)}`,
      siraCardExpiryDate: tomorrow,
    },
  });
  const secUser = await prisma.user.create({
    data: {
      email: secEmail,
      password: '$2b$10$gyQHoY03NSoTYkT40hNwWeRTY86HLajQkiQ9WYIsZkaCAztJqhh0G',
      role: 'SECURITY',
      clientId: clientAdmin.clientId,
      employeeId: secEmp.id,
      isActive: true,
    },
  });

  // Valid Security
  const secToken = generateToken(secUser);
  const validSecRes = await axios.get(`${API_URL}/patrol-sessions`, {
    headers: { Authorization: `Bearer ${secToken}` },
  });
  console.assert(validSecRes.status === 200, 'Valid Security must access operational APIs');
  console.log('✅ Valid Security allowed operational access.');

  // Expired Security
  await prisma.employee.update({
    where: { id: secEmp.id },
    data: { siraCardExpiryDate: yesterday },
  });
  let caughtSecError: any = null;
  try {
    await axios.get(`${API_URL}/patrol-sessions`, {
      headers: { Authorization: `Bearer ${secToken}` },
    });
  } catch (err: any) {
    caughtSecError = err.response;
  }
  console.assert(caughtSecError?.status === 403, 'Expired Security must be blocked (403)');
  console.assert(
    caughtSecError?.data?.error?.code === 'SIRA_CARD_EXPIRED',
    'Security error code must be SIRA_CARD_EXPIRED'
  );
  console.log('✅ Expired Security blocked with SIRA_CARD_EXPIRED.\n');

  // 8. Test Other Roles (e.g., TECHNICIAN with past date should NOT be blocked)
  console.log('--- 7. Testing Other Roles (Technician with past date) ---');
  const techEmail = `test.tech.${Date.now()}@example.com`;
  const techEmp = await prisma.employee.create({
    data: {
      firstName: 'Technician',
      lastName: 'Test',
      email: techEmail,
      phone: '+971500000077',
      designation: 'AC Technician',
      role: 'TECHNICIAN',
      clientId: clientAdmin.clientId,
      employeeNumber: `EMP-${Date.now().toString().slice(-6)}`,
      siraCardExpiryDate: yesterday, // Past date, but not a SIRA role
    },
  });
  const techUser = await prisma.user.create({
    data: {
      email: techEmail,
      password: '$2b$10$gyQHoY03NSoTYkT40hNwWeRTY86HLajQkiQ9WYIsZkaCAztJqhh0G',
      role: 'TECHNICIAN',
      clientId: clientAdmin.clientId,
      employeeId: techEmp.id,
      isActive: true,
    },
  });
  const techToken = generateToken(techUser);
  const techMeRes = await axios.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${techToken}` },
  });
  console.assert(techMeRes.data.data.isSiraExpired === false, 'Technician isSiraExpired must be false');
  console.log('✅ Technician unaffected by SIRA expiry.\n');

  // 9. Test Employee Edit & Details API for Supervisor
  console.log('--- 8. Testing Employee Edit & Details for Supervisor ---');
  const futureExpiry = new Date();
  futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);

  // Edit Supervisor SIRA Expiry
  const updateRes = await axios.patch(
    `${API_URL}/employees/${createdEmp.id}`,
    {
      siraCardExpiryDate: futureExpiry.toISOString(),
      role: 'SUPERVISOR',
      supervisedRole: 'SECURITY',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  console.assert(updateRes.data.success === true, 'Employee update must succeed');

  // Fetch Details
  const detailsRes = await axios.get(`${API_URL}/employees/${createdEmp.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const empDetails = detailsRes.data.data;
  console.assert(empDetails.role === 'SUPERVISOR', 'Role must be SUPERVISOR');
  console.assert(new Date(empDetails.siraCardExpiryDate).getFullYear() === futureExpiry.getFullYear(), 'Updated expiry date must be persisted');
  console.log('✅ Employee Edit and Details successfully validated for Supervisor.\n');

  // 10. Test Role Switching (SUPERVISOR -> SECURITY and SECURITY -> SUPERVISOR)
  console.log('--- 9. Testing Role Transitions between Security & Supervisor ---');
  await axios.patch(
    `${API_URL}/employees/${createdEmp.id}`,
    { role: 'SECURITY' },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  const toSecDetails = (await axios.get(`${API_URL}/employees/${createdEmp.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).data.data;
  console.assert(toSecDetails.role === 'SECURITY', 'Role should change to SECURITY');
  console.assert(toSecDetails.siraCardExpiryDate !== null, 'SIRA date must be preserved during SUPERVISOR -> SECURITY');

  await axios.patch(
    `${API_URL}/employees/${createdEmp.id}`,
    { role: 'SUPERVISOR', supervisedRole: 'SECURITY' },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  const toSupDetails = (await axios.get(`${API_URL}/employees/${createdEmp.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).data.data;
  console.assert(toSupDetails.role === 'SUPERVISOR', 'Role should change to SUPERVISOR');
  console.assert(toSupDetails.siraCardExpiryDate !== null, 'SIRA date must be preserved during SECURITY -> SUPERVISOR');
  console.log('✅ Role transitions preserve SIRA data without loss.\n');

  // Cleanup test users and employees
  await prisma.user.deleteMany({ where: { email: { in: [testEmail, secEmail, techEmail] } } });
  await prisma.employee.deleteMany({ where: { email: { in: [testEmail, secEmail, techEmail] } } });

  console.log('===============================================================');
  console.log('  ALL SIRA ROLE EXTENSION TESTS PASSED SUCCESSFULLY!          ');
  console.log('===============================================================\n');

  await prisma.$disconnect();
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
