import paramiko

SERVER_IP = "194.76.27.3"
SERVER_USER = "root"
SERVER_PASSWORD = "@.Pd4j4p0c@fgfgO0FE123"
PROJECT_PATH = "/var/www/orbit/hello-security"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASSWORD, timeout=30)

    script = """
const { PrismaClient } = require('/var/www/orbit/hello-security/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { employee: true }
  });
  console.log(`Total Users: ${users.length}`);
  let mismatched = 0;
  for (const u of users) {
    const userRole = u.role;
    const empRole = u.employee?.role;
    if (empRole && userRole !== empRole) {
      mismatched++;
      console.log(`Mismatched User: email=${u.email}, User.role=${userRole}, Employee.role=${empRole}`);
    }
  }
  console.log(`Total Mismatched Users: ${mismatched}`);
}
main().finally(() => prisma.$disconnect());
"""
    cmd = f"cat << 'EOF' > /tmp/check_mismatch.js\n{script}\nEOF"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.channel.recv_exit_status()

    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_PATH} && node /tmp/check_mismatch.js")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err:
        print("ERR:", err)

    ssh.close()

if __name__ == "__main__":
    main()
