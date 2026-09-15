import paramiko

SERVER_IP = "194.76.27.3"
SERVER_USER = "root"
SERVER_PASSWORD = "@.Pd4j4p0c@fgfgO0FE123"
PROJECT_PATH = "/var/www/orbit/hello-security"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)

    print("--- FOCUSED INSPECTION OF DATA ---")
    script = """
const { PrismaClient } = require('/var/www/orbit/hello-security/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 1. USER & EMPLOYEE ===');
  const user = await prisma.user.findFirst({
    where: { email: { equals: 'islam@ct.com', mode: 'insensitive' } },
    include: { employee: true }
  });
  console.log('User Role:', user?.role);
  console.log('Employee Role:', user?.employee?.role);

  console.log('\\n=== 2. SITE & CLIENT ===');
  const site = await prisma.site.findFirst({
    where: { name: { contains: 'Cleopatra', mode: 'insensitive' } },
    include: { client: true }
  });
  console.log('Site:', site?.id, site?.name);
  console.log('Client:', site?.client?.id, site?.client?.name);

  if (site) {
    console.log('\\n=== 3. SUBTASK MASTERS FOR CLIENT ===');
    const masters = await prisma.subTaskMaster.findMany({
      where: { clientId: site.clientId },
      include: { items: true }
    });
    for (const m of masters) {
      console.log(`Master ID: ${m.id}, Role: ${m.role}, Name: ${m.name}`);
      for (const item of m.items) {
        console.log(`   Item: id=${item.id}, taskName="${item.taskName}", isRequired=${item.isRequired}, role=${item.role}`);
      }
    }

    console.log('\\n=== 4. GATES & GATESUBTASKS IN CLEOPATRA ===');
    const gates = await prisma.gate.findMany({
      where: { siteId: site.id },
      select: { id: true, name: true, gateCode: true }
    });
    console.log(`Gates count: ${gates.length}`);
    const gateIds = gates.map(g => g.id);

    const gateSubTasks = await prisma.gateSubTask.findMany({
      where: { gateId: { in: gateIds } }
    });
    
    // Group by role
    const byRole = {};
    for (const gst of gateSubTasks) {
      byRole[gst.role] = byRole[gst.role] || [];
      byRole[gst.role].push(gst);
    }
    console.log('GateSubTasks breakdown by role:');
    for (const [r, list] of Object.entries(byRole)) {
      console.log(`  Role "${r}": count=${list.length}`);
      const taskNames = [...new Set(list.map(t => t.taskName))];
      console.log(`     Distinct Task Names:`, taskNames);
    }
  }
}
main().finally(() => prisma.$disconnect());
"""
    cmd = f"cat << 'EOF' > /tmp/focused_tech.js\n{script}\nEOF"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.channel.recv_exit_status()

    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_PATH} && node /tmp/focused_tech.js")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err:
        print("ERR:", err)

    ssh.close()

if __name__ == "__main__":
    main()
