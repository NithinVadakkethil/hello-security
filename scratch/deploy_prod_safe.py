#!/usr/bin/env python3
import sys
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=120)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    deploy_script = """
set -e
echo "=================================================="
echo "PRODUCTION DEPLOYMENT — HELLO SECURITY / ORBIT"
echo "=================================================="
cd /var/www/orbit/hello-security

echo "1. Fetching & pulling latest code from origin/major_updates..."
git fetch origin
git reset --hard HEAD
git clean -fd
git checkout major_updates
git pull origin major_updates

echo "2. Ensuring .env points to production database (orbitdb) and production base URLs..."
sed -i 's|hello_security|orbitdb|g' .env
sed -i 's|NODE_ENV=development|NODE_ENV=production|g' .env
grep -q "WEB_APP_URL" .env || echo 'WEB_APP_URL="https://orbit.helloentry.com"' >> .env
grep -q "PUBLIC_API_URL" .env || echo 'PUBLIC_API_URL="https://orbit.helloentry.com/api/v1"' >> .env
grep -q "API_URL" .env || echo 'API_URL="https://orbit.helloentry.com/api/v1"' >> .env
grep -E "DATABASE_URL|NODE_ENV|WEB_APP_URL|PUBLIC_API_URL|API_URL" .env

echo "3. Installing dependencies..."
pnpm install

echo "4. Generating Prisma client..."
npx prisma generate

echo "5. Building API module..."
pnpm nx build api

echo "6. Building Web module..."
pnpm nx build web

echo "7. Re-creating PM2 services with explicit working directory..."
pm2 delete hello-security-api hello-security-web || true
pm2 start api/dist/api/src/main.js --name hello-security-api --cwd /var/www/orbit/hello-security --update-env
pm2 start "pnpm nx start web -p 3000" --name hello-security-web --cwd /var/www/orbit/hello-security --update-env || pm2 restart hello-security-web --update-env
pm2 save

echo "8. Checking PM2 status..."
pm2 status

echo "=================================================="
echo "DEPLOYMENT COMPLETE!"
echo "=================================================="
"""

    code, out, err = run_ssh(deploy_script)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
    print(f"--- EXIT CODE: {code} ---")
