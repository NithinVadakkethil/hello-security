import { prisma } from '../api/src/database/prisma';

async function deleteThirteenthFloorCheckpoint() {
  const gateId = 'cmu3oxbt3000duth3kaxn75w9';
  const gate = await prisma.gate.findUnique({ where: { id: gateId } });
  if (gate) {
    await prisma.gate.delete({ where: { id: gateId } });
    console.log(`Successfully deleted checkpoint: id=${gate.id}, code=${gate.gateCode}, name="${gate.name}", floor="${gate.description}"`);
  } else {
    console.log('Checkpoint already deleted or not found.');
  }
}

deleteThirteenthFloorCheckpoint()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
