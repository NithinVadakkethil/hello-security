import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../api/src/modules/auth/utils/password';

const prisma = new PrismaClient();

async function main() {
  const email = 'anup.peninsula1@helloorbit.com';
  const user = await prisma.user.findFirst({ where: { email } });
  console.log('User found:', user?.email, user?.role);

  if (user) {
    const hash = await hashPassword('Password123!');
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    });
    console.log('Updated password to Password123! for local test user anup.peninsula1@helloorbit.com');
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
