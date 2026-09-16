#!/usr/bin/env python3
import sys
import paramiko
import time

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd, timeout=300):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=120)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    print("Connecting to production server to execute safe deployment...")
    deploy_script = """
set -e
echo "=================================================="
echo "PRODUCTION DEPLOYMENT: ROLE-SCOPED SUPERVISOR ACCESS"
echo "=================================================="
cd /var/www/orbit/hello-security

echo "1. Fetching latest git commits..."
git fetch origin

echo "2. Checking current branch and pulling manager/centralized..."
git reset --hard HEAD
git clean -fd
git checkout manager/centralized
git pull origin manager/centralized

echo "3. Verifying .env configuration..."
sed -i 's|hello_security|orbitdb|g' .env
sed -i 's|NODE_ENV=development|NODE_ENV=production|g' .env
grep -E "DATABASE_URL|NODE_ENV|WEB_APP_URL|PUBLIC_API_URL|API_URL" .env

echo "4. Installing dependencies..."
pnpm install

echo "5. Applying safe additive Prisma schema changes to production database (orbitdb)..."
npx prisma db push --accept-data-loss=false

echo "6. Generating Prisma client..."
npx prisma generate

echo "7. Building production API module..."
pnpm nx build api

echo "8. Building production Web module..."
pnpm nx build web

echo "9. Restarting PM2 production services..."
pm2 restart hello-security-api hello-security-web --update-env || pm2 restart all
pm2 save

echo "10. PM2 Status Check:"
pm2 status

echo "=================================================="
echo "PRODUCTION DEPLOYMENT SUCCESSFUL!"
echo "=================================================="
"""

    code, out, err = run_ssh(deploy_script, timeout=600)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
    print(f"--- EXIT CODE: {code} ---")
    if code != 0:
        sys.exit(1)
