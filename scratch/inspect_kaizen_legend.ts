import { prisma } from '../api/src/database/prisma';

async function checkKaizenLegend() {
  const user = await prisma.user.findUnique({
    where: { email: 'kaizen.legend@helloorbit.com' },
    include: {
      client: {
        include: {
          sites: {
            include: {
              gates: {
                include: {
                  category: true,
                  subTasks: true,
                },
                orderBy: { sequence: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.log('User kaizen.legend@helloorbit.com not found!');
    return;
  }

  console.log(`User: ${user.email}, Role: ${user.role}, Client: ${user.client?.companyName} (${user.clientId})`);
  for (const site of user.client?.sites || []) {
    console.log(`\nSite: ${site.name} (id: ${site.id}, total checkpoints: ${site.gates.length})`);
    
    // Group gates by description/floor
    const floorMap = new Map<string, typeof site.gates>();
    for (const g of site.gates) {
      const desc = g.description || 'No Floor/Description';
      const list = floorMap.get(desc) || [];
      list.push(g);
      floorMap.set(desc, list);
    }

    for (const [floor, gates] of floorMap.entries()) {
      console.log(`  Floor/Group "${floor}": ${gates.length} checkpoint(s)`);
      for (const g of gates) {
        console.log(`    - ID: ${g.id} | Code: ${g.gateCode} | Name: "${g.name}" | SubTasks: ${g.subTasks.length} | Cat: ${g.category?.name || 'None'}`);
      }
    }
  }

  // Check categories and category subtasks
  const categories = await prisma.checkpointCategory.findMany({
    where: { clientId: user.clientId || undefined },
    include: {
      subTasks: true,
      gates: true,
    },
  });

  console.log(`\nCategories count: ${categories.length}`);
  for (const c of categories) {
    console.log(`- Category "${c.name}" (id: ${c.id}) | SubTasks: ${c.subTasks.length} | Assigned Gates: ${c.gates.length}`);
  }

  // Check gate subtasks total
  const totalGateSubTasks = await prisma.gateSubTask.count({
    where: { gate: { site: { clientId: user.clientId || undefined } } },
  });
  console.log(`\nTotal GateSubTasks for client: ${totalGateSubTasks}`);
}

checkKaizenLegend()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
