import { prisma } from '../api/src/database/prisma';

async function checkFloorToDelete() {
  const g13 = await prisma.gate.findMany({
    where: { description: { contains: 'Thirteenth', mode: 'insensitive' } },
    include: {
      site: true,
      patrolCheckpoints: true,
      routeGates: true,
      assignmentGates: true,
    },
  });

  console.log('Thirteenth floor gates:', g13.map(g => ({
    id: g.id,
    code: g.gateCode,
    name: g.name,
    desc: g.description,
    site: g.site.name,
    patrolCheckpoints: g.patrolCheckpoints.length,
    routeGates: g.routeGates.length,
    assignmentGates: g.assignmentGates.length,
  })));
}

checkFloorToDelete().catch(console.error).finally(() => prisma.$disconnect());
