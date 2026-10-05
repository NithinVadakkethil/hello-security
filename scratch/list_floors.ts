import { prisma } from '../api/src/database/prisma';

async function listFloors() {
  const user = await prisma.user.findUnique({
    where: { email: 'kaizen.legend@helloorbit.com' },
    include: {
      client: {
        include: {
          sites: {
            include: {
              gates: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.client?.sites[0]) return;

  const site = user.client.sites[0];
  const floorCounts = new Map<string, number>();
  for (const g of site.gates) {
    const d = g.description?.trim() || 'No Description';
    floorCounts.set(d, (floorCounts.get(d) || 0) + 1);
  }

  console.log(`Site: ${site.name}`);
  for (const [floor, count] of floorCounts.entries()) {
    console.log(`Floor "${floor}": ${count} checkpoints`);
  }
}

listFloors().catch(console.error).finally(() => prisma.$disconnect());
