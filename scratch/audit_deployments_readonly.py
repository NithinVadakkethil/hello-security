#!/usr/bin/env python3
import paramiko
import os

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = os.environ.get('PROD_SSH_PASS', '@.Pd4j4p0c@O0FE123')

def run_ssh(cmd, timeout=60):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    cmd = """
echo "=== 1. PRODUCTION DEPLOYMENT (/var/www/orbit/hello-security) ==="
cd /var/www/orbit/hello-security
git status -sb
git log -1 --format="Commit: %H%nAuthor: %an <%ae>%nDate: %cd%nSubject: %s"
grep "^DATABASE_URL" .env | sed 's/:.*@/:***@/'

echo "\\n=== 2. DEMO DEPLOYMENT (/var/www/demoorbit/hello-security) ==="
cd /var/www/demoorbit/hello-security
git status -sb
git log -1 --format="Commit: %H%nAuthor: %an <%ae>%nDate: %cd%nSubject: %s"
grep "^DATABASE_URL" .env | sed 's/:.*@/:***@/'

echo "\\n=== 3. PM2 RUNNING SERVICES ==="
pm2 list
"""
    code, out, err = run_ssh(cmd)
    print(out)
    if err:
        print("ERRORS:", err)
