import paramiko
import sys

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    node_code = """
const path = require('path');
const { prisma } = require(path.join(__dirname, 'api/dist/api/src/database/prisma'));
const { comparePassword, hashPassword } = require(path.join(__dirname, 'api/dist/api/src/common/auth/bcrypt'));

async function test() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@hellosecurity.com' } });
  console.log('USER IN DB:', user ? { email: user.email, password: user.password } : 'NOT FOUND');

  const newHash = await hashPassword('Password123!');
  console.log('NEW HASH FROM BCRYPT TS:', newHash);

  const cmp = await comparePassword('Password123!', newHash);
  console.log('CMP NEW HASH:', cmp);

  if (user) {
    const cmpOld = await comparePassword('Password123!', user.password);
    console.log('CMP OLD DB HASH:', cmpOld);

    await prisma.user.update({
      where: { email: 'admin@hellosecurity.com' },
      data: { password: newHash, rawPassword: 'Password123!' }
    });
    console.log('UPDATED DB WITH VALID NEW HASH');
  }
}

test().catch(console.error).finally(() => prisma.$disconnect());
"""
    sftp = ssh.open_sftp()
    with sftp.open('/var/www/orbit/hello-security/fix_admin.js', 'w') as f:
        f.write(node_code)
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command('cd /var/www/orbit/hello-security && NODE_PATH=api/dist/api/src node fix_admin.js')
    print("STDOUT:", stdout.read().decode('utf-8'))
    print("STDERR:", stderr.read().decode('utf-8'))

    ssh.exec_command('rm -f /var/www/orbit/hello-security/fix_admin.js')
finally:
    ssh.close()
