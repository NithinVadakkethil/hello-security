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
    verify_cmd = """
echo \"=== STEP 18: PRODUCTION HEALTH CHECKS ===\"
echo \"--- 1. API Health (Port 3001) ---\"
curl -s -i http://127.0.0.1:3001/api/v1/health

echo \"\n--- 2. Public API Health (HTTPS) ---\"
curl -s -i https://orbit.helloentry.com/api/v1/health

echo \"\n--- 3. Public Web (HTTPS) ---\"
curl -s -I https://orbit.helloentry.com/

echo \"\n=== STEP 19 & 20: DATABASE SAFETY & POST-DEPLOYMENT COUNTS (orbitdb) ===\"
sudo -u postgres psql -d orbitdb -c '
SELECT 
  (SELECT count(*) FROM \"Client\") as clients_count,
  (SELECT count(*) FROM \"Site\") as sites_count,
  (SELECT count(*) FROM \"Gate\") as gates_count,
  (SELECT count(*) FROM \"Employee\") as employees_count,
  (SELECT count(*) FROM \"Shift\") as shifts_count,
  (SELECT count(*) FROM \"GuardAssignment\") as assignments_count,
  (SELECT count(*) FROM \"PatrolSession\") as patrol_sessions_count,
  (SELECT count(*) FROM \"Incident\") as incidents_count,
  (SELECT count(*) FROM \"GateSubTask\") as gate_subtasks_count,
  (SELECT count(*) FROM \"PatrolCheckpoint\") as patrol_checkpoints_count,
  (SELECT count(*) FROM \"User\") as users_count,
  (SELECT count(*) FROM \"Attendance\") as attendance_count,
  (SELECT count(*) FROM \"CheckpointCategory\") as checkpoint_categories_count,
  (SELECT count(*) FROM \"CategorySubTask\") as category_subtasks_count,
  (SELECT count(*) FROM \"MandatoryPatrolInstance\") as mandatory_patrol_instances_count;
'

echo \"\n=== STEP 21: VERIFY NO DEMO CONFIGURATION LEAKED INTO PRODUCTION ===\"
cd /var/www/orbit/hello-security
echo \"Checking .env for demo database or demo URLs:\"
grep -i "demoorbit" .env api/.env web/.env 2>/dev/null || echo "No demoorbit in .env (OK)"
echo \"Checking production web bundle or environment for demo ports:\"
grep "3101" .env api/.env web/.env 2>/dev/null || echo "No 3101 in .env (OK)"

echo \"\n=== PM2 LOG INSPECTION (hello-security-api & hello-security-web) ===\"
pm2 logs hello-security-api --lines 25 --nostream
pm2 logs hello-security-web --lines 25 --nostream

echo \"\n=== STEP 22: VERIFY ROLLBACK ARTIFACTS ===\"
ls -lh /var/backups/orbitdb_pre_kaizen_production_20261005_1744.dump
ls -lh /var/backups/orbit_app_pre_kaizen_20261005_1744.tar.gz
ls -lh /var/backups/orbit_env_pre_kaizen_20261005_1744.env
cd /var/www/orbit/hello-security
git tag -n1 | grep production-pre-kaizen
"""
    code, out, err = run_ssh(verify_cmd)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
