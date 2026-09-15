const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const axios = require('axios');

const prisma = new PrismaClient();

async function resetAndTest() {
  const defaultPassword = 'Password@123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const managerPassword = 'OrbitManager@2026';
  const hashedManagerPassword = await bcrypt.hash(managerPassword, 10);

  // Update all users in local DB to have valid hashed passwords
  const users = await prisma.user.findMany();
  for (const u of users) {
    const isMgr = u.role === 'MANAGER';
    const pwd = isMgr ? managerPassword : defaultPassword;
    const hPwd = isMgr ? hashedManagerPassword : hashedPassword;

    await prisma.user.update({
      where: { id: u.id },
      data: {
        password: hPwd,
        rawPassword: pwd,
        isActive: true,
      },
    });
    console.log(`Updated user ${u.email} (${u.role}) -> password: ${pwd}`);
  }

  console.log('\n--- TESTING LOCAL LOGINS ---');
  for (const u of users) {
    const pwd = u.role === 'MANAGER' ? managerPassword : defaultPassword;
    try {
      const res = await axios.post('http://localhost:3001/api/v1/auth/login', {
        email: u.email,
        password: pwd,
      });
      console.log(`✅ [${u.role}] Login SUCCESS: ${u.email} (Password: ${pwd})`);
    } catch (err) {
      console.error(`❌ [${u.role}] Login FAILED: ${u.email}`, err.response?.data || err.message);
    }
  }
}

resetAndTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
