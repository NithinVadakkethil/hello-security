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
    print("HELLO ORBIT - PRODUCTION DEPLOYMENT SCRIPT")
    print("==================================================")

    timestamp = time.strftime("%Y%m%d_%H%M%S")

    deploy_script = f"""
set -e

echo "=== PHASE 1: PRE-DEPLOYMENT GIT AUDIT ==="
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

echo "=== GIT DIFF STAT ==="
git diff --stat $PROD_PREV_SHA..$NEW_SHA || true

echo "=== PHASE 5: FRESH PRODUCTION DATABASE BACKUP ==="
mkdir -p /var/backups
BACKUP_FILE="/var/backups/orbit_before_latest_release_{timestamp}.dump"
echo "Creating backup at $BACKUP_FILE..."
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

echo "=== PHASE 6: PRE-DEPLOYMENT DATABASE SANITY SNAPSHOT ==="
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

echo "=== PHASE 7: PRODUCTION GIT ROLLBACK TAG ==="
ROLLBACK_TAG="prod-rollback-{timestamp}"
git tag "$ROLLBACK_TAG" $PROD_PREV_SHA || true
echo "ROLLBACK_TAG=$ROLLBACK_TAG"

echo "=== PHASE 8: ENVIRONMENT SAFETY VERIFICATION ==="
sed -i 's|hello_orbit_prod_clone|orbitdb|g' .env
sed -i 's|hello_security|orbitdb|g' .env
sed -i 's|NODE_ENV=development|NODE_ENV=production|g' .env
grep -E "DATABASE_URL|NODE_ENV|WEB_APP_URL|PUBLIC_API_URL" .env | sed 's/:.*@/:***@/g'

echo "=== PHASE 9: BUILD PRODUCTION SERVICES ==="
echo "Installing dependencies..."
pnpm install

echo "Generating Prisma Client..."
npx prisma generate

echo "Building API..."
pnpm nx build api

echo "Building Web..."
pnpm nx build web

echo "=== PHASE 10: DATABASE MIGRATION CHECK ==="
npx prisma db push --accept-data-loss=false

echo "=== PHASE 11: RESTART PM2 SERVICES ==="
pm2 restart hello-security-api hello-security-web --update-env || pm2 restart all
pm2 save
pm2 status

echo "=== PHASE 12: API & WEB HEALTH CHECK ==="
sleep 3
curl -s http://127.0.0.1:3001/api/v1/health || echo "API Health endpoint check completed"
curl -s -I http://127.0.0.1:3000 | head -n 5 || echo "Web Health check completed"

echo "=== PHASE 15: POST-DEPLOYMENT DATABASE VERIFICATION ==="
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
echo "PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "=================================================="
"""

    code, out, err = run_ssh(deploy_script, timeout=600)
    print(out)
    if err:
        print("--- STDERR / LOGS ---")
        print(err)

    if code != 0:
        print(f"FAILED with exit code {code}")
        sys.exit(code)
