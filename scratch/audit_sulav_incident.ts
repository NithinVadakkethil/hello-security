import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditSulav() {
  process.stdout.write('=== PHASE 1: USER AUDIT ===\n');
  const user = await prisma.user.findFirst({
    where: { email: 'sulav.peninsula1@helloorbit.com' },
    include: {
      client: true,
      employee: true,
    },
  });

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { email: 'sulav.peninsula1@helloorbit.com' },
        { firstName: { contains: 'Sulav', mode: 'insensitive' } },
        { lastName: { contains: 'Sulav', mode: 'insensitive' } },
      ],
    },
    include: {
      client: true,
      assignments: {
        include: {
          site: true,
          shift: true,
          patrolRoute: true,
        },
      },
    },
  });

  process.stdout.write(`USER: ${JSON.stringify(user ? { id: user.id, email: user.email, role: user.role } : 'Not found in User table')}\n`);
  process.stdout.write(`EMPLOYEE: ${JSON.stringify(employee ? {
    id: employee.id,
    code: employee.employeeNumber,
    name: `${employee.firstName} ${employee.lastName}`,
    email: employee.email,
    role: employee.role,
    client: employee.client?.companyName,
    clientId: employee.clientId,
    assignments: employee.assignments.map(a => ({
      id: a.id,
      site: a.site?.name,
      siteId: a.siteId,
      isActive: a.isActive,
      assignmentType: a.assignmentType,
    })),
  } : 'Not found in Employee table')}\n`);

  const empId = employee?.id || user?.employeeId;
  if (!empId) {
    process.stdout.write('No employee ID found to query sessions.\n');
    return;
  }

  process.stdout.write('\n=== PHASE 2: PATROL SESSIONS AUDIT ===\n');
  const sessions = await prisma.patrolSession.findMany({
    where: {
      OR: [
        { assignment: { employeeId: empId } },
        { managerUserId: user?.id },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      checkpoints: {
        select: {
          id: true,
          gateId: true,
          scannedAt: true,
          remarks: true,
          _count: { select: { subTaskResponses: true } },
        },
      },
      assignment: {
        select: {
          id: true,
          site: { select: { name: true } },
        },
      },
    },
  });

  process.stdout.write(`Found ${sessions.length} recent sessions for employee ${empId}:\n`);
  sessions.forEach(s => {
    process.stdout.write(`\nSession ID: ${s.id}\n`);
    process.stdout.write(`  Code: ${s.patrolCode}\n`);
    process.stdout.write(`  Status: ${s.status}\n`);
    process.stdout.write(`  Started: ${s.startedAt}\n`);
    process.stdout.write(`  Ended: ${s.endedAt}\n`);
    process.stdout.write(`  Created: ${s.createdAt}\n`);
    process.stdout.write(`  Checkpoints Count: ${s.checkpoints.length}\n`);
    s.checkpoints.forEach(cp => {
      process.stdout.write(`    - CP ${cp.id} | Gate: ${cp.gateId} | ScannedAt: ${cp.scannedAt} | SubTasks: ${cp._count.subTaskResponses}\n`);
    });
  });
}

auditSulav().catch(err => {
  process.stderr.write(String(err));
}).finally(() => prisma.$disconnect());
