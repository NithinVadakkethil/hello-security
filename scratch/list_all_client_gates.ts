import { prisma } from '../api/src/database/prisma';

async function listAllClientGates() {
  const user = await prisma.user.findUnique({
    where: { email: 'kaizen.legend@helloorbit.com' },
    include: {
      client: {
        include: {
          sites: {
            include: {
              gates: {
                orderBy: { sequence: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!user || !user.client) return;

  for (const site of user.client.sites) {
    console.log(`\n========================================`);
    console.log(`Site: ${site.name} (ID: ${site.id})`);
    console.log(`Total Gates: ${site.gates.length}`);
    const floorMap = new Map<string, number>();
    for (const g of site.gates) {
      const f = g.description?.trim() || 'No Description';
      floorMap.set(f, (floorMap.get(f) || 0) + 1);
    }
    for (const [f, c] of floorMap.entries()) {
      console.log(`  Floor "${f}": ${c} checkpoints`);
    }
  }
}

listAllClientGates().catch(console.error).finally(() => prisma.$disconnect());
