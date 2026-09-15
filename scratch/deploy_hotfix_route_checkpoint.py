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
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=180)
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
echo "PRODUCTION HOTFIX DEPLOYMENT — ROUTE CHECKPOINT REMOVAL"
echo "=================================================="
cd /var/www/orbit/hello-security

echo "1. Fetching latest remote branches..."
git fetch origin

echo "2. Checking out hotfix/route-checkpoint-removal..."
git checkout hotfix/route-checkpoint-removal
git reset --hard origin/hotfix/route-checkpoint-removal

echo "3. Ensuring production .env settings..."
sed -i 's|hello_security|orbitdb|g' .env
sed -i 's|NODE_ENV=development|NODE_ENV=production|g' .env
grep -q "WEB_APP_URL" .env || echo 'WEB_APP_URL="https://orbit.helloentry.com"' >> .env
grep -q "PUBLIC_API_URL" .env || echo 'PUBLIC_API_URL="https://orbit.helloentry.com/api/v1"' >> .env
grep -q "API_URL" .env || echo 'API_URL="https://orbit.helloentry.com/api/v1"' >> .env

echo "4. Verifying .env settings..."
grep -E "DATABASE_URL|NODE_ENV|WEB_APP_URL|PUBLIC_API_URL|API_URL" .env

echo "5. Verifying commit SHA..."
git log -n 1 --oneline

echo "6. Installing dependencies if needed..."
pnpm install

echo "7. Generating Prisma Client..."
npx prisma generate

echo "8. Building API module..."
pnpm nx build api

echo "9. Building Web module..."
pnpm nx build web

echo "10. Restarting PM2 services..."
pm2 restart hello-security-api --update-env
pm2 restart hello-security-web --update-env
pm2 save

echo "11. PM2 Status..."
pm2 status

echo "=================================================="
echo "PRODUCTION HOTFIX DEPLOYMENT COMPLETE!"
echo "=================================================="
"""

    code, out, err = run_ssh(deploy_script)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
    print(f"--- EXIT CODE: {code} ---")
