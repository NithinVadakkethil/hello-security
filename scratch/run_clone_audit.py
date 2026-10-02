import subprocess
import json
import re
import os

def run_psql(db, query):
    cmd = ["sudo", "-u", "postgres", "psql", "-d", db, "-t", "-A", "-c", query]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return f"ERROR: {res.stderr.strip()}"
    return res.stdout.strip()

def run_psql_rows(db, query):
    raw = run_psql(db, query)
    if raw.startswith("ERROR:"):
        return []
    lines = [line for line in raw.split("\n") if line.strip()]
    return lines

def get_env_dict(path):
    env = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

def redact_url(url):
    if not url:
        return url
    return re.sub(r'//([^:]+):([^@]+)@', r'//\1:*****@', url)

print("=== STARTING CLONE READINESS AUDIT ===")

# 1. Database Connections
print("\n--- PHASE 1: DATABASE CONNECTIONS ---")
prod_env_root = get_env_dict("/var/www/orbit/hello-security/.env")
prod_env_api = get_env_dict("/var/www/orbit/hello-security/api/.env")
demo_env_root = get_env_dict("/var/www/demoorbit/hello-security/.env")
demo_env_web = get_env_dict("/var/www/demoorbit/hello-security/web/.env")

prod_db_url = prod_env_api.get("DATABASE_URL") or prod_env_root.get("DATABASE_URL")
demo_db_url = demo_env_root.get("DATABASE_URL") or demo_env_web.get("DATABASE_URL")

print(f"Production DATABASE_URL: {redact_url(prod_db_url)}")
print(f"Demo DATABASE_URL:       {redact_url(demo_db_url)}")

# 2. Sizes & Versions
print("\n--- PHASE 2: DATABASE SIZE & DISK SPACE ---")
orbit_size = run_psql("postgres", "SELECT pg_size_pretty(pg_database_size('orbitdb'))")
orbit_bytes = run_psql("postgres", "SELECT pg_database_size('orbitdb')")
demo_size = run_psql("postgres", "SELECT pg_size_pretty(pg_database_size('demoorbitdb'))")
demo_bytes = run_psql("postgres", "SELECT pg_database_size('demoorbitdb')")
pg_ver = run_psql("postgres", "SELECT version()")

df_out = subprocess.run(["df", "-h", "/"], capture_output=True, text=True).stdout.strip()

print(f"orbitdb size:     {orbit_size} ({orbit_bytes} bytes)")
print(f"demoorbitdb size:  {demo_size} ({demo_bytes} bytes)")
print(f"PostgreSQL Ver:   {pg_ver}")
print(f"Filesystem Space:\n{df_out}")

# 3. Git Commits
print("\n--- GIT COMMITS ---")
prod_git = subprocess.run(["git", "-C", "/var/www/orbit/hello-security", "log", "-1", "--format=%H %d %s"], capture_output=True, text=True).stdout.strip()
demo_git = subprocess.run(["git", "-C", "/var/www/demoorbit/hello-security", "log", "-1", "--format=%H %d %s"], capture_output=True, text=True).stdout.strip()
print(f"Production commit: {prod_git}")
print(f"Demo commit:       {demo_git}")

# 4. Schema Objects Comparison
print("\n--- PHASE 3: SCHEMA OBJECTS ---")
def get_schema_summary(db):
    tables = run_psql_rows(db, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;")
    views = run_psql_rows(db, "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name;")
    exts = run_psql_rows(db, "SELECT extname FROM pg_extension ORDER BY extname;")
    seqs = run_psql_rows(db, "SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public' ORDER BY sequence_name;")
    enums = run_psql_rows(db, "SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid GROUP BY t.typname ORDER BY t.typname;")
    funcs = run_psql_rows(db, "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;")
    trigs = run_psql_rows(db, "SELECT trigger_name FROM information_schema.triggers GROUP BY trigger_name ORDER BY trigger_name;")
    fks = run_psql(db, "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';")
    uqs = run_psql(db, "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type = 'UNIQUE';")
    idxs = run_psql(db, "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';")
    return {
        "tables": tables,
        "views": views,
        "extensions": exts,
        "sequences": seqs,
        "enums": enums,
        "functions": funcs,
        "triggers": trigs,
        "fks": fks,
        "uqs": uqs,
        "idxs": idxs
    }

prod_schema = get_schema_summary("orbitdb")
demo_schema = get_schema_summary("demoorbitdb")

print(f"OrbitDB Tables: {len(prod_schema['tables'])}, DemoDB Tables: {len(demo_schema['tables'])}")
print(f"OrbitDB Views: {len(prod_schema['views'])}, DemoDB Views: {len(demo_schema['views'])}")
print(f"OrbitDB Extensions: {prod_schema['extensions']}, DemoDB Extensions: {demo_schema['extensions']}")
print(f"OrbitDB Sequences: {len(prod_schema['sequences'])}, DemoDB Sequences: {len(demo_schema['sequences'])}")
print(f"OrbitDB Enums: {prod_schema['enums']}, DemoDB Enums: {demo_schema['enums']}")
print(f"OrbitDB Foreign Keys: {prod_schema['fks']}, DemoDB Foreign Keys: {demo_schema['fks']}")
print(f"OrbitDB Unique Constraints: {prod_schema['uqs']}, DemoDB Unique Constraints: {demo_schema['uqs']}")
print(f"OrbitDB Indexes: {prod_schema['idxs']}, DemoDB Indexes: {demo_schema['idxs']}")
print(f"OrbitDB Functions: {len(prod_schema['functions'])}, DemoDB Functions: {len(demo_schema['functions'])}")
print(f"OrbitDB Triggers: {len(prod_schema['triggers'])}, DemoDB Triggers: {len(demo_schema['triggers'])}")

all_tables = sorted(list(set(prod_schema['tables'] + demo_schema['tables'])))

missing_in_demo = set(prod_schema['tables']) - set(demo_schema['tables'])
missing_in_prod = set(demo_schema['tables']) - set(prod_schema['tables'])

print(f"Tables in OrbitDB but not in DemoDB: {missing_in_demo}")
print(f"Tables in DemoDB but not in OrbitDB: {missing_in_prod}")

# 5. Table Row Counts
print("\n--- PHASE 4: TABLE ROW COUNTS COMPARISON ---")
comparison = []
for tbl in all_tables:
    p_count = run_psql("orbitdb", f'SELECT COUNT(*) FROM "{tbl}";') if tbl in prod_schema['tables'] else "N/A"
    d_count = run_psql("demoorbitdb", f'SELECT COUNT(*) FROM "{tbl}";') if tbl in demo_schema['tables'] else "N/A"
    try:
        diff = int(p_count) - int(d_count)
    except:
        diff = "N/A"
    comparison.append((tbl, p_count, d_count, diff))
    print(f"{tbl:<35} | Prod: {str(p_count):>8} | Demo: {str(d_count):>8} | Diff: {str(diff):>8}")

# 6. Media / External URLs Scan
print("\n--- PHASE 6: MEDIA / EXTERNAL URL COLUMNS ---")
columns_q = """
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND data_type IN ('text', 'character varying', 'json', 'jsonb')
ORDER BY table_name, column_name;
"""
cols = run_psql_rows("orbitdb", columns_q)
media_results = []
for line in cols:
    parts = line.split("|")
    if len(parts) != 3: continue
    tbl, col, dtype = parts
    # Check if any row contains http://, https://, cloudinary, s3, etc.
    q = f"""SELECT count(*) FROM "{tbl}" WHERE "{col}"::text ILIKE '%http%' OR "{col}"::text ILIKE '%cloudinary%' OR "{col}"::text ILIKE '%s3%' OR "{col}"::text ILIKE '%.png%' OR "{col}"::text ILIKE '%.jpg%' OR "{col}"::text ILIKE '%.jpeg%' OR "{col}"::text ILIKE '%/uploads/%';"""
    c = run_psql("orbitdb", q)
    try:
        cnt = int(c)
        if cnt > 0:
            media_results.append((tbl, col, cnt))
            print(f"Media Column found: {tbl}.{col} ({cnt} rows matching media/URL pattern)")
    except Exception as e:
        pass

# 7. Ownership
print("\n--- PHASE 9: DATABASE OWNERSHIP ---")
owners = run_psql_rows("postgres", "SELECT datname, pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname IN ('orbitdb', 'demoorbitdb');")
for line in owners:
    print(f"DB Owner: {line}")

# Privileges check for orbituser on demoorbitdb
orbituser_privs = run_psql("demoorbitdb", "SELECT has_database_privilege('orbituser', 'demoorbitdb', 'CREATE');")
print(f"orbituser HAS CREATE privilege on demoorbitdb: {orbituser_privs}")

# 8. External Integrations in Demo API
print("\n--- PHASE 14: EXTERNAL INTEGRATION CHECK IN DEMO API ---")
for k, v in demo_env_root.items():
    if any(x in k.upper() for x in ["SMTP", "MAIL", "SMS", "TWILIO", "FIREBASE", "FCM", "CLOUDINARY", "S3", "AWS", "STRIPE", "WEBHOOK", "REDIS", "BULL", "CRON"]):
        print(f"Demo env config: {k} = (set, redacted if sensitive)")

print("\n=== AUDIT DATA COLLECTION COMPLETE ===")
