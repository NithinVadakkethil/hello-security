const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== INVESTIGATING JONSON USER & EMPLOYEE DB RECORDS ===');

  const jonsonUser = await prisma.user.findFirst({
    where: { email: { contains: 'jonson', mode: 'insensitive' } },
    include: { employee: true },
  });

  console.log('User Record:', jonsonUser);

  const jonsonEmp = await prisma.employee.findFirst({
    where: { email: { contains: 'jonson', mode: 'insensitive' } },
    include: { user: true },
  });

  console.log('Employee Record:', jonsonEmp);

  // Check all employees where employee.role !== user.role
  const mismatchedEmployees = await prisma.employee.findMany({
    include: { user: true },
  });

  console.log('\nChecking for role mismatches across ALL employees:');
  let mismatchCount = 0;
  mismatchedEmployees.forEach((emp) => {
    if (emp.user && emp.role !== emp.user.role) {
      console.log(`- MISMATCH: Emp ID ${emp.id} | Email: ${emp.email} | Emp.role: "${emp.role}" | User.role: "${emp.user.role}"`);
      mismatchCount++;
    }
  });

  console.log(`Total employee/user role mismatches in DB: ${mismatchCount}`);

  await prisma.$disconnect();
}

main().catch(console.error);
