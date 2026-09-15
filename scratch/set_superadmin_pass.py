import paramiko
import sys

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(hostname, username=username, timeout=15)
    cmd = '''cd /var/www/orbit/hello-security && node -e "const b = require('./node_modules/.pnpm/bcrypt@6.0.0/node_modules/bcrypt'); console.log(b.hashSync('Password123!', 10));"'''
    stdin, stdout, stderr = ssh.exec_command(cmd)
    hash_str = stdout.read().decode('utf-8').strip()
    print("Generated Hash:", hash_str)

    if hash_str.startswith('$2'):
        update_sql = f'''sudo -u postgres psql -d orbitdb -c "UPDATE \\"User\\" SET password = '{hash_str}', \\"rawPassword\\" = 'Password123!' WHERE email = 'admin@hellosecurity.com';"'''
        ssh.exec_command(update_sql)
        print("Updated admin@hellosecurity.com password successfully.")

finally:
    ssh.close()
