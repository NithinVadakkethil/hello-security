#!/usr/bin/env python3
import paramiko
import time

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd, timeout=600):
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
    print("=== STARTING PRODUCTION CUTOVER (orbit.helloentry.com) ===")

    deploy_cmd = """
set -e
echo "=== STEP 11: SWITCH PRODUCTION CODE TO APPROVED BRANCH ==="
cd /var/www/orbit/hello-security
git fetch origin demo/kaizen-custom-features
git checkout demo/kaizen-custom-features
git pull origin demo/kaizen-custom-features
echo "Current HEAD on production:"
git log -n 1 --oneline

echo "=== STEP 12: VERIFY PRODUCTION ENVIRONMENT ==="
# Ensure .env preserves production values
ls -la .env
echo "Checking DATABASE_URL in .env:"
grep "DATABASE_URL" .env | sed -E 's/(:)[^:@]+(@)/\\1***\\2/'
grep "PORT" .env || true
grep "NODE_ENV" .env || true

echo "=== STEP 13 & 14: PRISMA GENERATE & BUILD API ==="
npx prisma generate
npx nx build api

echo "=== STEP 15: BUILD WEB ==="
npx nx build web

echo "=== STEP 16: APPLY REQUIRED PRISMA MIGRATIONS ==="
npx prisma migrate deploy

echo "=== STEP 17: RELOAD PM2 SERVICES (hello-security-api, hello-security-web) ==="
pm2 reload hello-security-api
pm2 reload hello-security-web
sleep 5
pm2 list

echo "=== STEP 18: IMMEDIATE HEALTH CHECK VERIFICATION ==="
echo "--- Local API (3001) ---"
curl -s -i http://127.0.0.1:3001/api/v1/health

echo "\n--- Local Web (3000) ---"
curl -s -I http://127.0.0.1:3000/

echo "\n--- Public Production Web (HTTPS) ---"
curl -s -I https://orbit.helloentry.com/
"""
    code, out, err = run_ssh(deploy_cmd, timeout=600)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
    if code != 0:
        print(f"FAILED WITH EXIT CODE: {code}")
        exit(1)
    print("\n=== PRODUCTION CUTOVER DEPLOYMENT COMPLETED ===")
