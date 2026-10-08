#!/usr/bin/env python3
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

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
echo "=== /var/www/demoorbit/hello-security GIT STATUS & BRANCH ==="
cd /var/www/demoorbit/hello-security && git status
cd /var/www/demoorbit/hello-security && git branch -a
cd /var/www/demoorbit/hello-security && git remote -v

echo "=== /var/www/demoorbit/hello-security .env (DATABASE_URL & PORT) ==="
cat /var/www/demoorbit/hello-security/.env | grep -E 'PORT|DATABASE_URL|REDIS|NODE_ENV|NEXT_PUBLIC_API_URL' 2>/dev/null || true
cat /var/www/demoorbit/hello-security/api/.env | grep -E 'PORT|DATABASE_URL|REDIS|NODE_ENV' 2>/dev/null || true
cat /var/www/demoorbit/hello-security/web/.env.local | grep -E 'PORT|DATABASE_URL|NEXT_PUBLIC_API_URL' 2>/dev/null || true

echo "=== /var/www/orbit/hello-security .env (DATABASE_URL & PORT) ==="
cat /var/www/orbit/hello-security/.env | grep -E 'PORT|DATABASE_URL|REDIS|NODE_ENV|NEXT_PUBLIC_API_URL' 2>/dev/null || true
"""
    code, out, err = run_ssh(cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
