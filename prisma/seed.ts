import { PrismaClient, UserRole } from '@prisma/client';

import { hashPassword } from '../api/src/common/auth/bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash the default password
  const superAdminPassword = await hashPassword('Admin@123');

  // Create or update Super Admin
  const superAdmin = await prisma.user.upsert({
    where: {
      email: 'admin@helloorbit.com',
    },
    update: {
      password: superAdminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email: 'admin@helloorbit.com',
      password: superAdminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log('✅ Super Admin seeded');
  console.log('------------------------------------');
  console.log(`Email    : ${superAdmin.email}`);
  console.log('Password : Admin@123');
  console.log(`Role     : ${superAdmin.role}`);
  console.log('------------------------------------');
  console.log('🌱 Database seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
