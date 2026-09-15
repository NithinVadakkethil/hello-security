import { prisma } from '../api/src/database/prisma';
import { hashPassword } from '../api/src/common/auth/bcrypt';

async function main() {
  const defaultPassword = 'Password@123';
  const hashedPassword = await hashPassword(defaultPassword);

  const managerPassword = 'OrbitManager@2026';
  const hashedManagerPassword = await hashPassword(managerPassword);

  // 1. Ensure Manager User exists
  let mgr = await prisma.user.findFirst({ where: { email: 'nithin@manager.com' } });
  if (mgr) {
    await prisma.user.update({
      where: { id: mgr.id },
      data: { password: hashedManagerPassword, rawPassword: managerPassword, isActive: true },
    });
  }

  // 2. Reset operational test accounts to Password@123
  const emailsToReset = [
    'mohan@vespa.com',
    'adhi@vespa.com',
    'nithin@vespa.com',
    'micheal@vespa.com',
    'habeeb@atlabas.com',
  ];

  for (const email of emailsToReset) {
    const user = await prisma.user.findFirst({ where: { email } });
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, rawPassword: defaultPassword, isActive: true },
      });
      console.log(`Updated ${email} password to: ${defaultPassword}`);
    }
  }

  console.log('✅ Local test accounts updated successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
