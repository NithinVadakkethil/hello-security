import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const managers = await prisma.user.findMany({
    where: { role: 'MANAGER' },
    include: {
      managerMemberships: {
        where: { isActive: true },
        include: { client: { select: { id: true, companyName: true } } },
      },
    },
  });

  for (const m of managers) {
    console.log(`\nManager: ${m.email} (${m.id})`);
    console.log(`Assigned Clients (${m.managerMemberships.length}):`);
    for (const mem of m.managerMemberships) {
      console.log(`  - ${mem.client.companyName} (${mem.client.id})`);
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
