import { prisma } from '../api/src/database/prisma';

async function auditData() {
  console.log('=== STARTING DATABASE SUBTASK AUDIT ===\n');

  const total = await prisma.gateSubTask.count();
  const active = await prisma.gateSubTask.count({ where: { isActive: true } });
  const inactive = await prisma.gateSubTask.count({ where: { isActive: false } });

  const inactiveItems = await prisma.gateSubTask.findMany({
    where: { isActive: false },
    select: {
      id: true,
      gateId: true,
      taskName: true,
      _count: {
        select: { responses: true },
      },
    },
  });

  const inactiveWithHistory = inactiveItems.filter((i) => i._count.responses > 0).length;
  const inactiveWithoutHistory = inactiveItems.filter((i) => i._count.responses === 0).length;

  console.log(`TOTAL_GATE_SUBTASKS = ${total}`);
  console.log(`ACTIVE_GATE_SUBTASKS = ${active}`);
  console.log(`INACTIVE_GATE_SUBTASKS = ${inactive}`);
  console.log(`INACTIVE_WITH_HISTORY = ${inactiveWithHistory}`);
  console.log(`INACTIVE_WITHOUT_HISTORY = ${inactiveWithoutHistory}`);

  // Inspect Vespa Perinthalmanna site specifically
  const vespaSite = await prisma.site.findFirst({
    where: { name: { contains: 'Vespa', mode: 'insensitive' } },
    include: {
      gates: {
        include: {
          subTasks: true,
        },
        orderBy: { sequence: 'asc' },
      },
    },
  });

  if (vespaSite) {
    console.log(`\n=== VESPA SITE: ${vespaSite.name} (${vespaSite.id}) ===`);
    vespaSite.gates.forEach((g) => {
      const activeCount = g.subTasks.filter((st) => st.isActive).length;
      const totalCount = g.subTasks.length;
      console.log(
        `Checkpoint: "${g.name}" (ID: ${g.id}) -> Total subtasks: ${totalCount}, Active subtasks: ${activeCount}`
      );
    });
  } else {
    console.log('\nSite "Vespa Perinthalmanna" not found in DB.');
  }
}

auditData()
  .catch((err) => console.error(err))
  .finally(async () => await prisma.$disconnect());
