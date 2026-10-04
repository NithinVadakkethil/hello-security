import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

async function testAttendanceFlow() {
  console.log('--- TESTING ATTENDANCE BACKEND LOGIC & AUTHORIZATION ---');

  // 1. Get an active user/client
  const user = await prisma.user.findFirst({
    where: { role: 'CLIENT_ADMIN', isActive: true },
    include: { client: true },
  });

  if (!user) {
    console.log('No CLIENT_ADMIN user found.');
    return;
  }

  console.log(`Found Client Admin: ${user.email} (Client: ${user.client?.name}, TenantId: ${user.tenantId})`);

  // 2. Query assignments count
  const assignments = await prisma.guardAssignment.findMany({
    where: { clientCompanyId: user.tenantId! },
    include: { employee: true, site: true, shift: true },
    take: 5,
  });

  console.log(`Found ${assignments.length} sample guard assignments for client ${user.client?.name}`);
  for (const a of assignments) {
    console.log(` - Guard: ${a.employee?.firstName} ${a.employee?.lastName} (${a.employee?.role}) at Site: ${a.site?.name}, Shift: ${a.shift?.name}`);
  }

  console.log('Backend verification complete.');
}

testAttendanceFlow()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
