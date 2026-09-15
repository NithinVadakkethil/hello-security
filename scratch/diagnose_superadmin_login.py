import paramiko
import json

SERVER_IP = "194.76.27.3"
SERVER_USER = "root"
PROJECT_PATH = "/var/www/orbit/hello-security"
UPDATED_PASS = "@.Pd4j4p0c@fgfgO0FE123"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_IP, username=SERVER_USER, timeout=30)

    print("Checking SUPER_ADMIN users in production database...")
    script = f"""
const {{ PrismaClient }} = require('/var/www/orbit/hello-security/node_modules/@prisma/client');
const bcrypt = require('/var/www/orbit/hello-security/node_modules/bcryptjs');
const prisma = new PrismaClient();

async function main() {{
  const superadmins = await prisma.user.findMany({{
    where: {{ role: 'SUPER_ADMIN' }},
    select: {{ id: true, email: true, role: true, status: true, password: true }}
  }});
  console.log('SUPER_ADMIN_COUNT:' + superadmins.length);
  for (const sa of superadmins) {{
    const matches = await bcrypt.compare('{UPDATED_PASS}', sa.password);
    console.log(`User: ${{sa.email}}, Status: ${{sa.status}}, PasswordMatchesUpdated: ${{matches}}`);
  }}
}}
main().finally(() => prisma.$disconnect());
"""
    cmd = f"cat << 'EOF' > /tmp/check_sa.js\n{script}\nEOF"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.channel.recv_exit_status()

    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_PATH} && node /tmp/check_sa.js")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err:
        print("ERR:", err)

    ssh.close()

if __name__ == "__main__":
    main()
