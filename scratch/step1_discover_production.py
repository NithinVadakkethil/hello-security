#!/usr/bin/env python3
import paramiko
import json

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd, timeout=120):
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
    discovery_cmd = """
echo "=== STEP 1: DISCOVER CURRENT PRODUCTION STATE ==="
echo "--- 1. Application Path & Git Status ---"
cd /var/www/orbit/hello-security
pwd
git status
echo "--- 2. Current Branch & Commit ---"
git branch --show-current
git rev-parse HEAD
git log -n 3 --oneline

echo "--- 3. PM2 Process List ---"
pm2 list

echo "--- 4. PM2 Show hello-security-api ---"
pm2 show hello-security-api | grep -E "name|script path|exec cwd|exec mode|node env|status|uptime|restarts|watching"

echo "--- 5. PM2 Show hello-security-web ---"
pm2 show hello-security-web | grep -E "name|script path|exec cwd|exec mode|node env|status|uptime|restarts|watching"

echo "--- 6. System Resources (Disk & Memory) ---"
df -h /
free -h

echo "--- 7. Production .env & DB configuration (masked) ---"
cd /var/www/orbit/hello-security
ls -la .env api/.env web/.env 2>/dev/null || true
grep -E "PORT|DATABASE_URL|NODE_ENV|NEXT_PUBLIC_API_URL" .env 2>/dev/null | sed -E 's/(:)[^:@]+(@)/\\1***\\2/'

echo "--- 8. PostgreSQL Version & Database List ---"
sudo -u postgres psql -c "SELECT version();"
sudo -u postgres psql -c "\l"

echo "--- 9. Production Database Record Counts (orbitdb) ---"
sudo -u postgres psql -d orbitdb -c "
SELECT 
  (SELECT count(*) FROM \"Client\") as clients_count,
  (SELECT count(*) FROM \"Site\") as sites_count,
  (SELECT count(*) FROM \"Gate\") as gates_count,
  (SELECT count(*) FROM \"Employee\") as employees_count,
  (SELECT count(*) FROM \"Shift\") as shifts_count,
  (SELECT count(*) FROM \"GuardAssignment\") as assignments_count,
  (SELECT count(*) FROM \"Attendance\") as attendance_count,
  (SELECT count(*) FROM \"PatrolSession\") as patrol_sessions_count,
  (SELECT count(*) FROM \"Incident\") as incidents_count,
  (SELECT count(*) FROM \"Notification\") as notifications_count,
  (SELECT count(*) FROM \"MandatoryPatrolInstance\") as mandatory_patrol_instances_count;
"

echo "--- 10. Existing Backups in /var/backups and /tmp ---"
ls -lh /var/backups/orbit* /var/backups/demoorbit* 2>/dev/null || true
ls -lh /tmp/*.dump 2>/dev/null || true

echo "--- 11. Current Production Health Check (Port 3001 & 3000) ---"
curl -s -i http://127.0.0.1:3001/api/v1/health || true
curl -s -I http://127.0.0.1:3000/ || true
curl -s -I https://orbit.helloentry.com/ || true
"""
    code, out, err = run_ssh(discovery_cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
