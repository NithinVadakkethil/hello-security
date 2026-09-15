const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const axios = require('axios');

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = 'admin@helloorbit.com';
  const superAdminPassword = 'Admin@123';
  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

  const user = await prisma.user.findFirst({ where: { email: superAdminEmail } });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        rawPassword: superAdminPassword,
        isActive: true,
      },
    });
    console.log(`✅ Updated ${superAdminEmail} password to: ${superAdminPassword}`);
  } else {
    await prisma.user.create({
      data: {
        email: superAdminEmail,
        password: hashedPassword,
        rawPassword: superAdminPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    console.log(`✅ Created Super Admin ${superAdminEmail} with password: ${superAdminPassword}`);
  }

  const mgrEmail = 'nithin@manager.com';
  const mgrPassword = 'Password123!';
  const mgrHashedPassword = await bcrypt.hash(mgrPassword, 10);
  const mgrUser = await prisma.user.findFirst({ where: { email: mgrEmail } });
  if (mgrUser) {
    await prisma.user.update({
      where: { id: mgrUser.id },
      data: {
        password: mgrHashedPassword,
        rawPassword: mgrPassword,
        isActive: true,
      },
    });
    console.log(`✅ Updated ${mgrEmail} password to: ${mgrPassword}`);
  }

  // Test login via API
  try {
    const res = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email: superAdminEmail,
      password: superAdminPassword,
    });
    console.log(`\n✅ TEST LOGIN SUCCESS for ${superAdminEmail}:`, res.data.data.user);
  } catch (err) {
    console.error(`❌ TEST LOGIN FAILED:`, err.response?.data || err.message);
  }

  try {
    const res = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email: mgrEmail,
      password: mgrPassword,
    });
    console.log(`\n✅ TEST LOGIN SUCCESS for ${mgrEmail}:`, res.data.data.user);
  } catch (err) {
    console.error(`❌ TEST LOGIN FAILED:`, err.response?.data || err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
