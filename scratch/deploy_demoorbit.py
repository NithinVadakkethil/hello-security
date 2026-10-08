#!/usr/bin/env python3
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
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    print("=== STARTING DEPLOYMENT TO DEMO SERVER (demoorbit.helloentry.com) ===")

    # 1. Database Backup
    print("\n--- STEP 1: TAKING DATABASE BACKUP OF demoorbitdb ---")
    backup_cmd = """
BACKUP_FILE="/tmp/demoorbitdb_pre_deploy_$(date +%Y%m%d_%H%M%S).dump"
echo "Creating backup: $BACKUP_FILE"
sudo -u postgres pg_dump -d demoorbitdb -F c -b -v -f "$BACKUP_FILE"
echo "Backup verification:"
ls -lh "$BACKUP_FILE"
"""
    code, out, err = run_ssh(backup_cmd, timeout=120)
    print(out)
    if code != 0:
        print("ERROR IN BACKUP:", err)
        exit(1)

    # 2. Git Pull on demo directory
    print("\n--- STEP 2: GIT PULL ON /var/www/demoorbit/hello-security ---")
    git_cmd = """
cd /var/www/demoorbit/hello-security
git fetch origin demo/kaizen-custom-features
git checkout demo/kaizen-custom-features
git pull origin demo/kaizen-custom-features
git log -n 2 --oneline
"""
    code, out, err = run_ssh(git_cmd, timeout=120)
    print(out)
    if err:
        print("Git info/warning:", err)
    if code != 0:
        print("ERROR IN GIT PULL:", err)
        exit(1)

    # 3. Prisma Generate & Migrate Deploy
    print("\n--- STEP 3: PRISMA MIGRATE & GENERATE ---")
    prisma_cmd = """
cd /var/www/demoorbit/hello-security
npx prisma generate
npx prisma migrate deploy
"""
    code, out, err = run_ssh(prisma_cmd, timeout=120)
    print(out)
    if err:
        print("Prisma info/warning:", err)
    if code != 0:
        print("ERROR IN PRISMA MIGRATION:", err)
        exit(1)

    # 4. Build API
    print("\n--- STEP 4: BUILD API ---")
    build_api_cmd = """
cd /var/www/demoorbit/hello-security
npx nx build api
"""
    code, out, err = run_ssh(build_api_cmd, timeout=240)
    print(out)
    if err:
        print("Build API info/warning:", err)
    if code != 0:
        print("ERROR IN API BUILD:", err)
        exit(1)

    # 5. Build Web
    print("\n--- STEP 5: BUILD WEB ---")
    build_web_cmd = """
cd /var/www/demoorbit/hello-security
npx nx build web
"""
    code, out, err = run_ssh(build_web_cmd, timeout=300)
    print(out)
    if err:
        print("Build Web info/warning:", err)
    if code != 0:
        print("ERROR IN WEB BUILD:", err)
        exit(1)

    # 6. PM2 Reload & Status
    print("\n--- STEP 6: RELOAD PM2 SERVICES (demoorbit-api, demoorbit-web) ---")
    pm2_cmd = """
pm2 reload demoorbit-api
pm2 reload demoorbit-web
sleep 3
pm2 status
"""
    code, out, err = run_ssh(pm2_cmd, timeout=60)
    print(out)
    if err:
        print("PM2 info:", err)

    # 7. Health Checks
    print("\n--- STEP 7: HEALTH CHECK VERIFICATION ---")
    verify_cmd = """
echo "=== DEMO API HEALTH CHECK (Port 3101) ==="
curl -s -i http://127.0.0.1:3101/api/v1/health

echo "\n=== DEMO WEB HEALTH CHECK (Port 3100) ==="
curl -s -I http://127.0.0.1:3100/

echo "\n=== PUBLIC DEMOORBIT DOMAIN (HTTPS) ==="
curl -s -I https://demoorbit.helloentry.com/
"""
    code, out, err = run_ssh(verify_cmd, timeout=60)
    print(out)
    if err:
        print("Verify info:", err)

    print("\n=== DEPLOYMENT COMPLETED SUCCESSFULLY ===")
