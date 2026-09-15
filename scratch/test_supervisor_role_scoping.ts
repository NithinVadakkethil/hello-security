import { PrismaClient, UserRole } from '@prisma/client';
import {
  getSupervisorScope,
  buildSupervisorPatrolWhere,
  buildSupervisorObservationWhere,
  buildSupervisorSnagWhere,
  buildSupervisorEmployeeWhere,
} from '../api/src/common/auth/supervisor-scope';

const prisma = new PrismaClient();

async function main() {
  console.log('=== TESTING SUPERVISOR ROLE SCOPING LOGIC ===');

  // 1. Get or create test client
  let client = await prisma.client.findFirst({ where: { clientCode: 'TEST_SCOPE_CLI' } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        clientCode: 'TEST_SCOPE_CLI',
        companyName: 'Test Role Scoping Client',
        email: 'test.scoping@orbit.com',
      },
    });
  }

  const clientId = client.id;
  console.log(`[1] Client ID: ${clientId}`);

  // 2. Create test employees
  const sEmp = await prisma.employee.upsert({
    where: { clientId_employeeNumber: { clientId, employeeNumber: 'EMP_SEC_01' } },
    update: { role: UserRole.SECURITY },
    create: {
      clientId,
      employeeNumber: 'EMP_SEC_01',
      firstName: 'Security',
      lastName: 'Guard',
      role: UserRole.SECURITY,
    },
  });

  const tEmp = await prisma.employee.upsert({
    where: { clientId_employeeNumber: { clientId, employeeNumber: 'EMP_TECH_01' } },
    update: { role: UserRole.TECHNICIAN },
    create: {
      clientId,
      employeeNumber: 'EMP_TECH_01',
      firstName: 'Technician',
      lastName: 'Field',
      role: UserRole.TECHNICIAN,
    },
  });

  const hEmp = await prisma.employee.upsert({
    where: { clientId_employeeNumber: { clientId, employeeNumber: 'EMP_CLN_01' } },
    update: { role: UserRole.CLEANER },
    create: {
      clientId,
      employeeNumber: 'EMP_CLN_01',
      firstName: 'Housekeeping',
      lastName: 'Cleaner',
      role: UserRole.CLEANER,
    },
  });

  console.log(`[2] Created 3 operational guards: SECURITY (${sEmp.id}), TECHNICIAN (${tEmp.id}), CLEANER (${hEmp.id})`);

  // 3. Test Supervisor Scope Helpers
  const sScope = { clientId, supervisedRole: UserRole.SECURITY };
  const tScope = { clientId, supervisedRole: UserRole.TECHNICIAN };
  const hScope = { clientId, supervisedRole: UserRole.CLEANER };

  // 4. Test Employee Filtering
  const sEmployees = await prisma.employee.findMany({
    where: buildSupervisorEmployeeWhere(sScope),
  });
  console.log(`[3] Security Supervisor sees ${sEmployees.length} employee(s):`, sEmployees.map(e => `${e.firstName} (${e.role})`));
  if (sEmployees.length !== 1 || sEmployees[0].role !== UserRole.SECURITY) {
    throw new Error('Security Supervisor employee filtering failed!');
  }

  const tEmployees = await prisma.employee.findMany({
    where: buildSupervisorEmployeeWhere(tScope),
  });
  console.log(`[4] Technician Supervisor sees ${tEmployees.length} employee(s):`, tEmployees.map(e => `${e.firstName} (${e.role})`));
  if (tEmployees.length !== 1 || tEmployees[0].role !== UserRole.TECHNICIAN) {
    throw new Error('Technician Supervisor employee filtering failed!');
  }

  const hEmployees = await prisma.employee.findMany({
    where: buildSupervisorEmployeeWhere(hScope),
  });
  console.log(`[5] Housekeeping Supervisor sees ${hEmployees.length} employee(s):`, hEmployees.map(e => `${e.firstName} (${e.role})`));
  if (hEmployees.length !== 1 || hEmployees[0].role !== UserRole.CLEANER) {
    throw new Error('Housekeeping Supervisor employee filtering failed!');
  }

  // 5. Test Observation Filtering
  const sObs = await prisma.incident.create({
    data: {
      clientId,
      employeeId: sEmp.id,
      type: 'SECURITY_BREACH',
      severity: 'HIGH',
      description: 'Door unlocked',
    },
  });

  const tObs = await prisma.incident.create({
    data: {
      clientId,
      employeeId: tEmp.id,
      type: 'EQUIPMENT_FAULT',
      severity: 'MEDIUM',
      description: 'AC leak',
    },
  });

  const sObsList = await prisma.incident.findMany({
    where: buildSupervisorObservationWhere(sScope),
  });
  console.log(`[6] Security Supervisor sees ${sObsList.length} observation(s) out of 2 total.`);
  if (sObsList.length !== 1 || sObsList[0].id !== sObs.id) {
    throw new Error('Observation filtering failed for Security Supervisor!');
  }

  const tObsList = await prisma.incident.findMany({
    where: buildSupervisorObservationWhere(tScope),
  });
  console.log(`[7] Technician Supervisor sees ${tObsList.length} observation(s) out of 2 total.`);
  if (tObsList.length !== 1 || tObsList[0].id !== tObs.id) {
    throw new Error('Observation filtering failed for Technician Supervisor!');
  }

  // 6. Cleanup test records
  await prisma.incident.deleteMany({ where: { clientId } });
  await prisma.employee.deleteMany({ where: { clientId } });
  await prisma.client.delete({ where: { id: clientId } });

  console.log('=== ALL SUPERVISOR ROLE SCOPING TESTS PASSED PERFECTLY! ===');
}

main()
  .catch((e) => {
    console.error('Test Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
