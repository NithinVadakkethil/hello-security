import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const clients = await prisma.client.findMany({
    select: { id: true, companyName: true },
  });

  for (const c of clients) {
    const sessions = await prisma.patrolSession.findMany({
      where: { clientId: c.id },
      include: {
        checkpoints: true,
        assignment: {
          include: {
            patrolRoute: { include: { routeGates: true } },
            assignmentGates: true,
          },
        },
      },
    });

    let scanned = 0;
    let required = 0;
    for (const s of sessions) {
      scanned += s.checkpoints.length;
      const isDirect =
        (s.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
        (!s.assignment?.patrolRoute && (s.assignment?.assignmentGates?.length || 0) > 0);
      const reqGates = s.managerUserId
        ? s.checkpoints.length
        : isDirect
        ? s.assignment?.assignmentGates?.length || 0
        : s.assignment?.patrolRoute?.routeGates?.length || 0;
      required += reqGates > 0 ? reqGates : s.checkpoints.length;
    }
    const missed = Math.max(0, required - scanned);

    console.log(`Client: ${c.companyName} (${c.id})`);
    console.log(`- Total Sessions: ${sessions.length}`);
    console.log(`- Scanned Checkpoints: ${scanned}`);
    console.log(`- Required Checkpoints: ${required}`);
    console.log(`- Missed Checkpoints: ${missed}`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
