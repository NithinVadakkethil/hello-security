import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findUnique({
    where: { id: 'cmt45w6ib002lhprgwh3g7qhx' },
  });
  console.log('Client record:', client);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
