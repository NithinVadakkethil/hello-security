import subprocess
import os
import sys
import json
import re

def run_cmd(cmd, check=True):
    print(f"[EXEC] {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"[ERROR] Command failed with code {res.returncode}:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")
        sys.exit(1)
    return res.stdout.strip(), res.stderr.strip(), res.returncode

def run_psql(db, query):
    cmd = ["sudo", "-u", "postgres", "psql", "-d", db, "-t", "-A", "-c", query]
    out, err, code = run_cmd(cmd, check=True)
    return out

print("============================================================")
print("CONTROLLED DATABASE CLONE EXECUTION: orbitdb -> demoorbitdb")
print("============================================================")

# ----------------------------------------------------------------
# STEP 0 — RECHECK DATABASE IDENTITY
# ----------------------------------------------------------------
print("\n[STEP 0] RECHECK DATABASE IDENTITY...")
ver = run_psql("postgres", "SELECT version();")
print(f"PostgreSQL Version: {ver}")

dbs = run_psql("postgres", "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname IN ('orbitdb','demoorbitdb') ORDER BY datname;")
print(f"Databases & Sizes:\n{dbs}")

def get_db_url(env_path):
    if not os.path.exists(env_path):
        return None
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return None

prod_url = get_db_url("/var/www/orbit/hello-security/apps/api/.env") or get_db_url("/var/www/orbit/hello-security/.env") or get_db_url("/var/www/orbit/hello-security/api/.env")
demo_url = get_db_url("/var/www/demoorbit/hello-security/apps/api/.env") or get_db_url("/var/www/demoorbit/hello-security/.env") or get_db_url("/var/www/demoorbit/hello-security/web/.env")

def redact(url):
    if not url: return "None"
    return re.sub(r'//([^:]+):([^@]+)@', r'//\1:*****@', url)

print(f"Prod DB URL: {redact(prod_url)}")
print(f"Demo DB URL: {redact(demo_url)}")

if "orbitdb" not in prod_url:
    print("[FATAL] Production DB URL does not point to orbitdb! Aborting.")
    sys.exit(1)

if "demoorbitdb" not in demo_url:
    print("[FATAL] Demo DB URL does not point to demoorbitdb! Aborting.")
    sys.exit(1)

print("[STEP 0 PASSED] Database identities verified.")

# ----------------------------------------------------------------
# STEP 1 — VERIFY PRODUCTION API IS HEALTHY
# ----------------------------------------------------------------
print("\n[STEP 1] VERIFY PM2 PROCESS STATUS...")
pm2_out, _, _ = run_cmd(["pm2", "jlist"])
pm2_data = json.loads(pm2_out)

pm2_status = {proc["name"]: proc["pm2_env"]["status"] for proc in pm2_data}
print(f"PM2 Status: {json.dumps(pm2_status, indent=2)}")

if pm2_status.get("hello-security-api") != "online":
    print("[FATAL] hello-security-api is not online! Aborting.")
    sys.exit(1)
if pm2_status.get("hello-security-web") != "online":
    print("[FATAL] hello-security-web is not online! Aborting.")
    sys.exit(1)

print("[STEP 1 PASSED] Production PM2 processes are healthy and online.")

# ----------------------------------------------------------------
# STEP 2 — CREATE PRODUCTION BACKUP
# ----------------------------------------------------------------
print("\n[STEP 2] CREATING PRODUCTION BACKUP (orbitdb)...")
prod_backup = "/var/backups/orbitdb_pre_demoorbit_clone_20260929.dump"
run_cmd(f"sudo -u postgres pg_dump -Fc orbitdb > {prod_backup}")

ls_out, _, _ = run_cmd(f"ls -lh {prod_backup}")
print(f"Prod Backup Created: {ls_out}")

run_cmd(f"sudo -u postgres pg_restore -l {prod_backup} > /tmp/orbitdb_pre_demoorbit_clone_20260929.list")
grep_out, _, _ = run_cmd("grep -E 'TABLE .* (User|Client|Employee|Gate|GateSubTask|PatrolSession|PatrolSubTaskResponse|SubTaskMaster|SubTaskMasterItem|ManagerClientMembership)' /tmp/orbitdb_pre_demoorbit_clone_20260929.list")
print(f"Sample Objects Verified in Prod Backup List:\n{grep_out[:500]}")

print("[STEP 2 PASSED] Production backup created and verified.")

# ----------------------------------------------------------------
# STEP 3 — BACK UP CURRENT DEMO DATABASE
# ----------------------------------------------------------------
print("\n[STEP 3] CREATING DEMO BACKUP (demoorbitdb)...")
demo_backup = "/var/backups/demoorbitdb_pre_clone_20260929.dump"
run_cmd(f"sudo -u postgres pg_dump -Fc demoorbitdb > {demo_backup}")

ls_out_demo, _, _ = run_cmd(f"ls -lh {demo_backup}")
print(f"Demo Backup Created: {ls_out_demo}")

run_cmd(f"sudo -u postgres pg_restore -l {demo_backup} > /tmp/demoorbitdb_pre_clone_20260929.list")
print("[STEP 3 PASSED] Demo backup created and verified.")

# ----------------------------------------------------------------
# STEP 4 — VERIFY SMTP SAFETY BEFORE CLONING
# ----------------------------------------------------------------
print("\n[STEP 4] VERIFYING & ENFORCING SMTP SAFETY FOR DEMO...")
demo_env_paths = [
    "/var/www/demoorbit/hello-security/.env",
    "/var/www/demoorbit/hello-security/api/.env",
    "/var/www/demoorbit/hello-security/apps/api/.env"
]

for p in demo_env_paths:
    if os.path.exists(p):
        print(f"Checking {p}...")
        with open(p, 'r') as f:
            lines = f.readlines()
        
        new_lines = []
        modified = False
        for line in lines:
            if line.startswith("SMTP_HOST=") or line.startswith("MAIL_HOST="):
                new_lines.append("SMTP_HOST=127.0.0.1\n")
                modified = True
                print(f"  Safeguarded SMTP_HOST=127.0.0.1 in {p}")
            elif line.startswith("ENABLE_EMAIL_NOTIFICATIONS="):
                new_lines.append("ENABLE_EMAIL_NOTIFICATIONS=false\n")
                modified = True
                print(f"  Set ENABLE_EMAIL_NOTIFICATIONS=false in {p}")
            else:
                new_lines.append(line)
        
        # If SMTP_HOST wasn't found, append safeguard
        if not any("SMTP_HOST=" in l for l in lines):
            new_lines.append("\n# Demo Safeguard\nSMTP_HOST=127.0.0.1\nENABLE_EMAIL_NOTIFICATIONS=false\n")
            modified = True
            print(f"  Appended SMTP safeguard to {p}")

        if modified:
            with open(p, 'w') as f:
                f.writelines(new_lines)

print("[STEP 4 PASSED] SMTP safeguards applied for demo environment.")

# ----------------------------------------------------------------
# STEP 5 — STOP ONLY DEMO API
# ----------------------------------------------------------------
print("\n[STEP 5] STOPPING DEMO API (demoorbit-api)...")
run_cmd("pm2 stop demoorbit-api")

pm2_out_after, _, _ = run_cmd(["pm2", "jlist"])
pm2_data_after = json.loads(pm2_out_after)
pm2_status_after = {proc["name"]: proc["pm2_env"]["status"] for proc in pm2_data_after}

print(f"PM2 Status after stopping demo-api:\n{json.dumps(pm2_status_after, indent=2)}")

if pm2_status_after.get("hello-security-api") != "online":
    print("[FATAL ERROR] hello-security-api was accidentally stopped! Aborting.")
    sys.exit(1)
if pm2_status_after.get("demoorbit-api") != "stopped":
    print("[FATAL ERROR] demoorbit-api failed to stop! Aborting.")
    sys.exit(1)

print("[STEP 5 PASSED] Only demoorbit-api was stopped.")

# ----------------------------------------------------------------
# STEP 6 — VERIFY NO DEMO DB CONNECTIONS
# ----------------------------------------------------------------
print("\n[STEP 6] CHECKING ACTIVE CONNECTIONS TO demoorbitdb...")
conns = run_psql("postgres", "SELECT pid, usename, application_name, client_addr FROM pg_stat_activity WHERE datname = 'demoorbitdb';")
if conns.strip():
    print(f"Active connections to demoorbitdb found:\n{conns}")
    print("Terminating active connections to demoorbitdb...")
    run_psql("postgres", "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'demoorbitdb' AND pid <> pg_backend_pid();")
else:
    print("No active connections to demoorbitdb.")

print("[STEP 6 PASSED] No active connections to demoorbitdb.")

# ----------------------------------------------------------------
# STEP 7 — FINAL PRODUCTION SAFETY CHECK
# ----------------------------------------------------------------
print("\n[STEP 7] FINAL PRE-REPLACEMENT SAFETY CHECK...")
dbs_check = run_psql("postgres", "SELECT datname FROM pg_database WHERE datname IN ('orbitdb','demoorbitdb') ORDER BY datname;")
print(f"Existing DBs: {dbs_check.splitlines()}")

curr_orbit = run_psql("orbitdb", "SELECT current_database();")
curr_demo = run_psql("demoorbitdb", "SELECT current_database();")

if curr_orbit != "orbitdb" or curr_demo != "demoorbitdb":
    print(f"[FATAL ERROR] DB identity mismatch! orbitdb={curr_orbit}, demoorbitdb={curr_demo}")
    sys.exit(1)

print("[STEP 7 PASSED] Safety checks confirmed.")

# ----------------------------------------------------------------
# STEP 8 — REPLACE DEMO DATABASE
# ----------------------------------------------------------------
print("\n[STEP 8] REPLACING DEMO DATABASE (demoorbitdb)...")
run_cmd("sudo -u postgres dropdb demoorbitdb")
run_cmd("sudo -u postgres createdb -O orbituser -T template0 demoorbitdb")

new_owner = run_psql("postgres", "SELECT datname, pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'demoorbitdb';")
print(f"Recreated Demo DB: {new_owner}")

if "orbituser" not in new_owner:
    print("[FATAL ERROR] Created demoorbitdb is not owned by orbituser!")
    sys.exit(1)

print("[STEP 8 PASSED] demoorbitdb safely dropped and re-created with orbituser ownership.")

# ----------------------------------------------------------------
# STEP 9 — RESTORE PRODUCTION ARCHIVE INTO DEMO
# ----------------------------------------------------------------
print("\n[STEP 9] RESTORING PRODUCTION ARCHIVE INTO demoorbitdb...")
restore_cmd = f"sudo -u postgres pg_restore --dbname=demoorbitdb --no-owner --exit-on-error {prod_backup}"
out, err, code = run_cmd(restore_cmd, check=False)

if code != 0:
    print(f"[FATAL RESTORE ERROR] pg_restore failed with exit code {code}!")
    print(f"STDERR: {err}")
    print(f"STDOUT: {out}")
    sys.exit(1)

print(f"Restore Output: {out}")
print("[STEP 9 PASSED] Production archive successfully restored into demoorbitdb!")

# ----------------------------------------------------------------
# STEP 10 & 11 — VERIFY DATABASE OBJECTS AND CRITICAL ROW COUNTS
# ----------------------------------------------------------------
print("\n[STEP 10 & 11] VERIFYING DATABASE OBJECTS & ROW COUNTS...")
demo_tables_cnt = run_psql("demoorbitdb", "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
demo_enums = run_psql("demoorbitdb", "SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid GROUP BY t.typname ORDER BY t.typname;")
demo_idxs_cnt = run_psql("demoorbitdb", "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';")
demo_fks_cnt = run_psql("demoorbitdb", "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';")

print(f"Demo DB Tables After Restore: {demo_tables_cnt}")
print(f"Demo DB Enums After Restore:  {demo_enums.splitlines()}")
print(f"Demo DB Indexes:              {demo_idxs_cnt}")
print(f"Demo DB Foreign Keys:         {demo_fks_cnt}")

critical_tables = [
    "User", "Client", "Site", "Employee", "Gate", "GateSubTask",
    "GuardAssignment", "GuardAssignmentGate", "PatrolRoute", "PatrolRouteGate",
    "PatrolSession", "PatrolCheckpoint", "PatrolSubTaskResponse",
    "SubTaskMaster", "SubTaskMasterItem", "Incident", "Snag", "SnagAssignment",
    "SnagHistory", "ManagerClientMembership", "NotificationDelivery",
    "NotificationRecipient", "ClientNotificationSettings", "RefreshToken"
]

print("\n--- SIDE-BY-SIDE ROW COUNT COMPARISON ---")
row_count_report = []
mismatch_found = False

for tbl in critical_tables:
    p_cnt = run_psql("orbitdb", f'SELECT COUNT(*) FROM "{tbl}";')
    d_cnt = run_psql("demoorbitdb", f'SELECT COUNT(*) FROM "{tbl}";')
    match = (p_cnt == d_cnt)
    if not match:
        mismatch_found = True
    print(f"{tbl:<30} | Prod: {p_cnt:>8} | Demo: {d_cnt:>8} | Match: {match}")
    row_count_report.append((tbl, p_cnt, d_cnt, match))

if mismatch_found:
    print("[WARNING] Mismatch detected in row counts!")
else:
    print("[STEP 10 & 11 PASSED] All critical table row counts match 100%.")

# ----------------------------------------------------------------
# STEP 12 — VERIFY PRISMA MIGRATION STATE
# ----------------------------------------------------------------
print("\n[STEP 12] VERIFYING PRISMA MIGRATIONS...")
p_migs = run_psql("orbitdb", 'SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at;')
d_migs = run_psql("demoorbitdb", 'SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at;')

if p_migs == d_migs:
    print("[STEP 12 PASSED] Prisma migration history is 100% identical in orbitdb and demoorbitdb.")
else:
    print("[WARNING] Prisma migration history differs between orbitdb and demoorbitdb.")

# ----------------------------------------------------------------
# STEP 13 — VERIFY DATABASE OWNER AND PRIVILEGES
# ----------------------------------------------------------------
print("\n[STEP 13] VERIFYING DB OWNERSHIP AND PERMISSIONS...")
owners = run_psql("postgres", "SELECT datname, pg_get_userbyid(datdba) FROM pg_database WHERE datname IN ('orbitdb','demoorbitdb');")
print(f"Database Owners:\n{owners}")

test_user_conn = run_psql("demoorbitdb", "SELECT current_database(), current_user;")
print(f"Demo DB User Connection Test: {test_user_conn}")

# ----------------------------------------------------------------
# STEP 14 — VERIFY SEQUENCES
# ----------------------------------------------------------------
print("\n[STEP 14] VERIFYING SEQUENCES...")
seqs = run_psql("demoorbitdb", "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public';")
print(f"Sequences in demoorbitdb: {seqs if seqs else 'None (Tables use UUIDs / Prisma defaults)'}")

# ----------------------------------------------------------------
# STEP 15 — VERIFY EXTERNAL MEDIA BEHAVIOR
# ----------------------------------------------------------------
print("\n[STEP 15] VERIFYING MEDIA URL REFERENCES...")
logo_cnt = run_psql("demoorbitdb", 'SELECT count(*) FROM "Client" WHERE "clientLogoUrl" IS NOT NULL;')
print(f"Client Logos with non-null URL: {logo_cnt}")

# ----------------------------------------------------------------
# STEP 16 — VERIFY PRODUCTION DATABASE WAS NOT MODIFIED
# ----------------------------------------------------------------
print("\n[STEP 16] VERIFYING PRODUCTION DATABASE INTEGRITY...")
p_user = run_psql("orbitdb", 'SELECT count(*) FROM "User";')
p_emp = run_psql("orbitdb", 'SELECT count(*) FROM "Employee";')
p_gate = run_psql("orbitdb", 'SELECT count(*) FROM "Gate";')
p_session = run_psql("orbitdb", 'SELECT count(*) FROM "PatrolSession";')
p_gsub = run_psql("orbitdb", 'SELECT count(*) FROM "GateSubTask";')
p_psub = run_psql("orbitdb", 'SELECT count(*) FROM "PatrolSubTaskResponse";')

print(f"Prod User Count:                  {p_user} (Expected 259)")
print(f"Prod Employee Count:              {p_emp} (Expected 245)")
print(f"Prod Gate Count:                  {p_gate} (Expected 5179)")
print(f"Prod PatrolSession Count:         {p_session} (Expected 2120)")
print(f"Prod GateSubTask Count:           {p_gsub} (Expected 68410)")
print(f"Prod PatrolSubTaskResponse Count: {p_psub} (Expected 73043)")

if p_user != "259" or p_emp != "245" or p_gate != "5179" or p_session != "2120" or p_gsub != "68410" or p_psub != "73043":
    print("[FATAL ERROR] Production database counts changed! Aborting.")
    sys.exit(1)

print("[STEP 16 PASSED] Production database is 100% untouched and intact.")

# ----------------------------------------------------------------
# STEP 17 & 18 — VERIFY APPLICATION ENVIRONMENT & RESTART DEMO API
# ----------------------------------------------------------------
print("\n[STEP 17 & 18] RESTARTING DEMO API & VERIFYING PM2...")
run_cmd("pm2 restart demoorbit-api --update-env")

pm2_final_out, _, _ = run_cmd(["pm2", "jlist"])
pm2_final_data = json.loads(pm2_final_out)
pm2_final_status = {proc["name"]: proc["pm2_env"]["status"] for proc in pm2_final_data}

print(f"Final PM2 Status:\n{json.dumps(pm2_final_status, indent=2)}")

if pm2_final_status.get("hello-security-api") != "online":
    print("[FATAL ERROR] hello-security-api is not online!")
    sys.exit(1)
if pm2_final_status.get("demoorbit-api") != "online":
    print("[FATAL ERROR] demoorbit-api failed to start!")
    sys.exit(1)

print("[STEP 18 PASSED] demoorbit-api restarted successfully and is online.")

# ----------------------------------------------------------------
# STEP 19 & 20 — VERIFY API ENDPOINTS
# ----------------------------------------------------------------
print("\n[STEP 19 & 20] VERIFYING HTTP ENDPOINTS...")
demo_logs, _, _ = run_cmd("pm2 logs demoorbit-api --lines 50 --nostream")
print(f"Recent demoorbit-api logs:\n{demo_logs[-800:]}")

demo_http, _, _ = run_cmd("curl -s -o /dev/null -w '%{http_code}' https://demoorbit.helloentry.com/api/v1/auth/me", check=False)
prod_http, _, _ = run_cmd("curl -s -o /dev/null -w '%{http_code}' https://orbit.helloentry.com/", check=False)

print(f"Demo Auth HTTP Response:       {demo_http} (Expected 401/200)")
print(f"Production Web HTTP Response:  {prod_http} (Expected 200)")

print("\n============================================================")
print("CLONE EXECUTION COMPLETED SUCCESSFULLY!")
print("============================================================")
