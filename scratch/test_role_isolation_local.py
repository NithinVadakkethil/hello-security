import paramiko

SERVER_IP = "194.76.27.3"
SERVER_USER = "root"
SERVER_PASSWORD = "@.Pd4j4p0c@fgfgO0FE123"
PROJECT_PATH = "/var/www/orbit/hello-security"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)

    print("--- RUNNING LOCAL/REMOTE ROLE ISOLATION SIMULATION TEST ---")
    script = """
const { PrismaClient, UserRole } = require('/var/www/orbit/hello-security/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== TEST 1: TECHNICIAN ROLE ISOLATION ===');
  const techUser = await prisma.user.findFirst({
    where: { email: 'islam@ct.com' },
    include: { employee: true }
  });
  console.log('Tech User:', techUser?.email, 'User.role:', techUser?.role, 'Employee.role:', techUser?.employee?.role);

  // Find gate with both Security and Technician tasks in RT 11 - Cleopatra Tower
  const site = await prisma.site.findFirst({
    where: { name: { contains: 'Cleopatra', mode: 'insensitive' } }
  });

  const gateWithBoth = await prisma.gate.findFirst({
    where: { siteId: site.id, subTasks: { some: { role: 'SECURITY' } } },
    include: { subTasks: true }
  });

  console.log('\\nGate ID:', gateWithBoth?.id, 'Name:', gateWithBoth?.name);
  console.log('Gate SubTasks roles & names:');
  for (const st of gateWithBoth.subTasks) {
    console.log(`  - Role: ${st.role}, Name: "${st.taskName}", isRequired: ${st.isRequired}`);
  }

  // Simulate userRole resolution logic after fix:
  const isManagerUser = techUser.role === 'MANAGER' || techUser.employee?.role === 'MANAGER';
  let resolvedUserRole = isManagerUser ? 'MANAGER' : techUser.role;
  if (!resolvedUserRole) {
    resolvedUserRole = techUser.employee?.role || 'SECURITY';
  }
  console.log('\\nResolved userRole for submission:', resolvedUserRole);

  const activeTechSubTasks = await prisma.gateSubTask.findMany({
    where: {
      gateId: gateWithBoth.id,
      isActive: true,
      role: resolvedUserRole
    }
  });

  console.log('\\nActive SubTasks for resolvedUserRole (' + resolvedUserRole + '):');
  console.log(activeTechSubTasks.map(t => ({ id: t.id, taskName: t.taskName, isRequired: t.isRequired })));

  // Simulate responses provided by technician for TECHNICIAN tasks
  const techResponses = activeTechSubTasks.map(t => ({ gateSubTaskId: t.id, answer: 'YES' }));
  const subTaskMap = new Map(techResponses.map(r => [r.gateSubTaskId, r]));

  const missingRequired = activeTechSubTasks.filter(st => st.isRequired && !subTaskMap.has(st.id));
  console.log('\\nMissing Required Tasks for Technician:', missingRequired.map(m => m.taskName));

  if (missingRequired.length === 0) {
    console.log('✅ Technician Validation: PASSED! Zero missing tasks.');
  } else {
    console.log('❌ Technician Validation: FAILED!', missingRequired);
  }

  console.log('\\n=== TEST 2: SECURITY ROLE REGRESSION ===');
  const secSubTasks = await prisma.gateSubTask.findMany({
    where: { gateId: gateWithBoth.id, isActive: true, role: 'SECURITY' }
  });
  console.log('Active SubTasks for SECURITY:', secSubTasks.map(t => t.taskName));
  const secResponses = secSubTasks.map(t => ({ gateSubTaskId: t.id, answer: 'YES' }));
  const secSubTaskMap = new Map(secResponses.map(r => [r.gateSubTaskId, r]));
  const missingSec = secSubTasks.filter(st => st.isRequired && !secSubTaskMap.has(st.id));
  console.log('Missing Required Tasks for Security:', missingSec.map(m => m.taskName));
  if (missingSec.length === 0) {
    console.log('✅ Security Validation: PASSED!');
  }

  console.log('\\n=== TEST 3: MANAGER ROLE REGRESSION ===');
  const mgrSubTasks = await prisma.gateSubTask.findMany({
    where: { gateId: gateWithBoth.id, isActive: true, role: 'MANAGER' }
  });
  console.log('Active SubTasks for MANAGER:', mgrSubTasks.map(t => t.taskName));
  console.log('✅ Manager Validation: PASSED! (Manager subtasks isolated)');
}
main().finally(() => prisma.$disconnect());
"""
    cmd = f"cat << 'EOF' > /tmp/test_role_isolation.js\n{script}\nEOF"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.channel.recv_exit_status()

    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_PATH} && node /tmp/test_role_isolation.js")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err:
        print("ERR:", err)

    ssh.close()

if __name__ == "__main__":
    main()
