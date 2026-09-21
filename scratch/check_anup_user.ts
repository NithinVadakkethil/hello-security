import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const assignmentId = 'cmt8b7tql01k5hp7s0cq63agx';
  const assignment = await prisma.guardAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      patrolRoute: {
        include: {
          routeGates: {
            include: { gate: true },
          },
        },
      },
    },
  });

  console.log('Assignment details:');
  console.log('Route name:', assignment?.patrolRoute?.name);
  console.log('Gates:');
  assignment?.patrolRoute?.routeGates.forEach((rg, idx) => {
    console.log(`Gate #${idx + 1}:`, {
      gateId: rg.gate.id,
      gateName: rg.gate.name,
      gateCode: rg.gate.gateCode,
    });
  });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
