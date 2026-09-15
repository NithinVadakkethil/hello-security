import paramiko
import sys

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {hostname}...")
    ssh.connect(hostname, username=username, timeout=15)
    print("Connected successfully.")

    def run(cmd):
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8').strip()
        return out

    tables = [
        ("Client", 'SELECT count(*) FROM "Client"'),
        ("User", 'SELECT count(*) FROM "User"'),
        ("Employee", 'SELECT count(*) FROM "Employee"'),
        ("Site", 'SELECT count(*) FROM "Site"'),
        ("Gate", 'SELECT count(*) FROM "Gate"'),
        ("GateSubTask", 'SELECT count(*) FROM "GateSubTask"'),
        ("PatrolRoute", 'SELECT count(*) FROM "PatrolRoute"'),
        ("GuardAssignment", 'SELECT count(*) FROM "GuardAssignment"'),
        ("PatrolSession", 'SELECT count(*) FROM "PatrolSession"'),
        ("Incident", 'SELECT count(*) FROM "Incident"'),
        ("Snag", 'SELECT count(*) FROM "Snag"'),
        ("ManagerClientMembership", 'SELECT count(*) FROM "ManagerClientMembership"')
    ]

    print("\n=== FINAL PRODUCTION DATA COUNTS ===")
    for tbl, sql in tables:
        cmd = f"""sudo -u postgres psql -d orbitdb -t -c '{sql}'"""
        cnt = run(cmd)
        print(f"  {tbl}: {cnt}")

    # PM2 Process check
    print("\n=== PM2 STATUS ===")
    pm2_out = run("pm2 jlist")
    import json
    procs = json.loads(pm2_out)
    for p in procs:
        print(f"  Process: {p.get('name')} | Status: {p.get('pm2_env', {}).get('status')} | Restarts: {p.get('pm2_env', {}).get('restart_time')} | Uptime: {p.get('pm2_env', {}).get('pm_uptime')}")

    # Clean up verification DB and temporary files if any
    run("sudo -u postgres dropdb --if-exists hello_security_backup_verify")
    run("rm -f /tmp/prod_smoke_test.js")
    print("\nCleaned up verification database and temporary test files.")

except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    ssh.close()
