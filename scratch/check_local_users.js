const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 20,
    select: {
      id: true,
      email: true,
      role: true,
      rawPassword: true,
      isActive: true,
      clientId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log('=== LOCAL DB USERS ===');
  console.table(users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
