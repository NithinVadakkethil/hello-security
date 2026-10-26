#!/usr/bin/env python3
"""
Phase 2 — Read-Only Identity & Pre-Deletion Audit of demoorbitdb
Target: 194.76.27.3
Database: demoorbitdb
"""
import paramiko
import json

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def main():
    print("=" * 70)
    print("PHASE 2 — READ-ONLY IDENTITY & PRE-DELETION AUDIT OF DEMOORBITDB")
    print("=" * 70)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)

    # 1. Verify environment configuration on disk
    print("\n[1] Verifying Demo Environment Configuration on Disk:")
    verify_env_cmd = """
echo "=== /var/www/demoorbit/hello-security/.env ==="
grep -E 'DATABASE_URL|PORT|NODE_ENV' /var/www/demoorbit/hello-security/.env
"""
    stdin, stdout, stderr = client.exec_command(verify_env_cmd)
    env_out = stdout.read().decode('utf-8').strip()
    print(env_out)

    if 'orbitdb' in env_out and 'demoorbitdb' not in env_out:
        print("❌ FATAL: Demo configuration points to orbitdb! Aborting.")
        client.close()
        return

    # 2. Query PostgreSQL demoorbitdb directly
    print("\n[2] Connecting to PostgreSQL to verify current_database() and table counts:")
    audit_sql = """
sudo -u postgres psql -d demoorbitdb -X -A -F'|' -c "
SELECT current_database(), current_user, inet_server_port();

-- Check table existence and counts
SELECT 'Client' as table_name, count(*) as count FROM \\\"Client\\\"
UNION ALL
SELECT 'Employee', count(*) FROM \\\"Employee\\\"
UNION ALL
SELECT 'User', count(*) FROM \\\"User\\\"
UNION ALL
SELECT 'FaceEnrollment', count(*) FROM \\\"FaceEnrollment\\\"
UNION ALL
SELECT 'Attendance', count(*) FROM \\\"Attendance\\\"
UNION ALL
SELECT 'PatrolSession', count(*) FROM \\\"PatrolSession\\\"
UNION ALL
SELECT 'PatrolCheckpoint', count(*) FROM \\\"PatrolCheckpoint\\\"
UNION ALL
SELECT 'Incident', count(*) FROM \\\"Incident\\\"
UNION ALL
SELECT 'Snag', count(*) FROM \\\"Snag\\\";
"
"""
    stdin, stdout, stderr = client.exec_command(audit_sql)
    db_out = stdout.read().decode('utf-8').strip()
    print(db_out)

    # 3. Detailed breakdown of FaceEnrollment per client in demoorbitdb
    print("\n[3] Breakdown of FaceEnrollment Records by Client in demoorbitdb:")
    breakdown_sql = """
sudo -u postgres psql -d demoorbitdb -X -A -F'|' -c "
SELECT 
    c.id as client_id,
    c.name as client_name,
    c.\\\"clientCode\\\",
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT fe.id) as enrolled_faces,
    COUNT(CASE WHEN fe.status = 'REGISTERED' THEN 1 END) as registered_faces,
    COUNT(CASE WHEN fe.status = 'REVOKED' THEN 1 END) as revoked_faces
FROM \\\"Client\\\" c
LEFT JOIN \\\"Employee\\\" e ON e.\\\"clientId\\\" = c.id
LEFT JOIN \\\"FaceEnrollment\\\" fe ON fe.\\\"clientId\\\" = c.id
GROUP BY c.id, c.name, c.\\\"clientCode\\\"
ORDER BY enrolled_faces DESC, c.name ASC;
"
"""
    stdin, stdout, stderr = client.exec_command(breakdown_sql)
    breakdown_out = stdout.read().decode('utf-8').strip()
    print(breakdown_out)

    # 4. Detailed list of all enrolled employees in demoorbitdb
    print("\n[4] Detailed List of Current FaceEnrollment Records in demoorbitdb:")
    enrolled_sql = """
sudo -u postgres psql -d demoorbitdb -X -A -F'|' -c "
SELECT 
    fe.id as enrollment_id,
    c.name as client_name,
    e.\\\"employeeCode\\\",
    e.\\\"fullName\\\",
    e.designation,
    u.email as linked_user_email,
    fe.status,
    fe.\\\"modelName\\\",
    fe.\\\"modelVersion\\\",
    fe.\\\"embeddingDimension\\\",
    fe.\\\"registeredAt\\\"
FROM \\\"FaceEnrollment\\\" fe
JOIN \\\"Employee\\\" e ON fe.\\\"employeeId\\\" = e.id
JOIN \\\"Client\\\" c ON fe.\\\"clientId\\\" = c.id
LEFT JOIN \\\"User\\\" u ON e.\\\"userId\\\" = u.id
ORDER BY c.name, e.\\\"fullName\\\";
"
"""
    stdin, stdout, stderr = client.exec_command(enrolled_sql)
    enrolled_out = stdout.read().decode('utf-8').strip()
    print(enrolled_out)

    # 5. Check foreign keys referencing FaceEnrollment
    print("\n[5] Checking Foreign Key Dependencies on FaceEnrollment:")
    fk_sql = """
sudo -u postgres psql -d demoorbitdb -X -A -F'|' -c "
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE ccu.table_name = 'FaceEnrollment';
"
"""
    stdin, stdout, stderr = client.exec_command(fk_sql)
    fk_out = stdout.read().decode('utf-8').strip()
    print(fk_out if fk_out else "None (FaceEnrollment has no child tables referencing it)")

    # 6. Check Redis keys
    print("\n[6] Checking Redis Keys for Face Enrollment:")
    redis_cmd = "redis-cli keys '*face*' || true"
    stdin, stdout, stderr = client.exec_command(redis_cmd)
    redis_out = stdout.read().decode('utf-8').strip()
    print("Redis face keys:", redis_out if redis_out else "(empty / none)")

    client.close()
    print("\n" + "=" * 70)
    print("PHASE 2 COMPLETED")
    print("=" * 70)

if __name__ == '__main__':
    main()
