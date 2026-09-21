#!/usr/bin/env python3
import sys
import time
import paramiko

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
    print("==================================================")
    print("HELLO ORBIT — CONTROLLED PRODUCTION DEPLOYMENT")
    print("==================================================")

    timestamp = time.strftime("%Y%m%d_%H%M%S")

    deploy_script = f"""
set -e

echo "=== STEP 1: PRE-DEPLOYMENT GIT AUDIT ==="
cd /var/www/orbit/hello-security
PROD_PREV_SHA=$(git rev-parse HEAD)
echo "PRODUCTION_PREVIOUS_SHA=$PROD_PREV_SHA"

echo "Stashing/resetting local tracked config changes on server..."
git checkout -- .env web/next-env.d.ts || true

git fetch origin
git checkout manager/centralized
git pull origin manager/centralized
NEW_SHA=$(git rev-parse HEAD)
echo "PRODUCTION_NEW_SHA=$NEW_SHA"

echo "Ensuring .env points to production database (orbitdb)..."
sed -i 's|hello_orbit_prod_clone|orbitdb|g' .env || true
sed -i 's|hello_security|orbitdb|g' .env || true

echo "=== STEP 2: FRESH PRODUCTION DATABASE BACKUP ==="
mkdir -p /var/backups
BACKUP_FILE="/var/backups/orbitdb_before_release_{timestamp}.dump"
echo "Creating full postgres backup at $BACKUP_FILE..."
sudo -u postgres pg_dump -d orbitdb -F c -b -v -f "$BACKUP_FILE"

if [ -s "$BACKUP_FILE" ]; then
    echo "Backup created successfully."
    ls -lh "$BACKUP_FILE"
    sha256sum "$BACKUP_FILE"
    sudo -u postgres pg_restore --list "$BACKUP_FILE" > /dev/null
    echo "BACKUP_VALID=YES"
else
    echo "BACKUP_FAILED"
    exit 1
fi

echo "=== STEP 3: PRE-DEPLOYMENT DATABASE ROW COUNT SNAPSHOT ==="
sudo -u postgres psql -d orbitdb -c "
SELECT 
  (SELECT COUNT(*) FROM \\"User\\") as users,
  (SELECT COUNT(*) FROM \\"Client\\") as clients,
  (SELECT COUNT(*) FROM \\"Employee\\") as employees,
  (SELECT COUNT(*) FROM \\"Site\\") as sites,
  (SELECT COUNT(*) FROM \\"Gate\\") as gates,
  (SELECT COUNT(*) FROM \\"Shift\\") as shifts,
  (SELECT COUNT(*) FROM \\"PatrolRoute\\") as patrol_routes,
  (SELECT COUNT(*) FROM \\"GuardAssignment\\") as guard_assignments,
  (SELECT COUNT(*) FROM \\"PatrolSession\\") as patrol_sessions,
  (SELECT COUNT(*) FROM \\"PatrolCheckpoint\\") as patrol_checkpoints,
  (SELECT COUNT(*) FROM \\"GateSubTask\\") as gate_subtasks,
  (SELECT COUNT(*) FROM \\"SubTaskMaster\\") as subtask_masters,
  (SELECT COUNT(*) FROM \\"Snag\\") as snags,
  (SELECT COUNT(*) FROM \\"Incident\\") as incidents,
  (SELECT COUNT(*) FROM \\"_prisma_migrations\\") as migrations;
"

echo "=== STEP 4: SAFE ADDITIVE MIGRATION EXECUTION ==="
echo "Adding companyName column to Employee table if not exists..."
sudo -u postgres psql -d orbitdb -c 'ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "companyName" TEXT;'

echo "=== STEP 5: PRISMA GENERATE & BUILD SERVICES ==="
npx prisma generate
pnpm nx build api
pnpm nx build web

echo "=== STEP 6: PM2 RELOAD SERVICES ==="
pm2 reload hello-security-api --update-env || pm2 restart hello-security-api --update-env
pm2 reload hello-security-web --update-env || pm2 restart hello-security-web --update-env
pm2 save

echo "=== STEP 7: PM2 STATUS CHECK ==="
pm2 status

echo "=== STEP 8: POST-DEPLOYMENT DATABASE ROW COUNT SNAPSHOT ==="
sudo -u postgres psql -d orbitdb -c "
SELECT 
  (SELECT COUNT(*) FROM \\"User\\") as users,
  (SELECT COUNT(*) FROM \\"Client\\") as clients,
  (SELECT COUNT(*) FROM \\"Employee\\") as employees,
  (SELECT COUNT(*) FROM \\"Site\\") as sites,
  (SELECT COUNT(*) FROM \\"Gate\\") as gates,
  (SELECT COUNT(*) FROM \\"Shift\\") as shifts,
  (SELECT COUNT(*) FROM \\"PatrolRoute\\") as patrol_routes,
  (SELECT COUNT(*) FROM \\"GuardAssignment\\") as guard_assignments,
  (SELECT COUNT(*) FROM \\"PatrolSession\\") as patrol_sessions,
  (SELECT COUNT(*) FROM \\"PatrolCheckpoint\\") as patrol_checkpoints,
  (SELECT COUNT(*) FROM \\"GateSubTask\\") as gate_subtasks,
  (SELECT COUNT(*) FROM \\"SubTaskMaster\\") as subtask_masters,
  (SELECT COUNT(*) FROM \\"Snag\\") as snags,
  (SELECT COUNT(*) FROM \\"Incident\\") as incidents,
  (SELECT COUNT(*) FROM \\"_prisma_migrations\\") as migrations;
"

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
    sys.exit(code)
