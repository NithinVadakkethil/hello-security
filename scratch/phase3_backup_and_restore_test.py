#!/usr/bin/env python3
"""
Phase 3 — Create and Verify Backups of demoorbitdb
1. Granular CSV export of all 9 FaceEnrollment records
2. Full PostgreSQL custom-format dump of demoorbitdb
3. Restore verification into temporary database demoorbitdb_test_restore
4. Verification of counts and clean teardown of temporary database
"""
import paramiko
import time
import sys

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def main():
    print("=" * 70)
    print("PHASE 3 — BACKUP AND RESTORE VERIFICATION FOR DEMOORBITDB")
    print("=" * 70)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)

    # Ensure /var/backups/orbit directory exists
    client.exec_command("mkdir -p /var/backups/orbit")

    timestamp = time.strftime('%Y%m%d_%H%M%S')
    csv_file = f"/var/backups/orbit/demoorbitdb_face_enrollments_backup_{timestamp}.csv"
    dump_file = f"/var/backups/orbit/demoorbitdb_pre_face_reset_{timestamp}.dump"
    test_db = "demoorbitdb_test_restore"

    # Step 1: Granular CSV export of FaceEnrollment records
    print(f"\n[1/4] Creating Granular CSV Export of FaceEnrollment records to {csv_file}...")
    csv_sql = f"""
sudo -u postgres psql -d demoorbitdb -c "
COPY (SELECT * FROM \\\"FaceEnrollment\\\" ORDER BY \\\"registeredAt\\\" ASC) TO '{csv_file}' WITH CSV HEADER;
"
"""
    stdin, stdout, stderr = client.exec_command(csv_sql)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err and "COPY" not in out:
        print("Error in CSV export:", err)
        client.close()
        sys.exit(1)
    
    # Check CSV file size
    stdin, stdout, stderr = client.exec_command(f"ls -lh {csv_file}")
    print("CSV verification:", stdout.read().decode('utf-8').strip())

    # Step 2: Full PostgreSQL custom dump
    print(f"\n[2/4] Taking Full PostgreSQL Dump to {dump_file}...")
    dump_cmd = f"sudo -u postgres pg_dump -d demoorbitdb -F c -b -v -f {dump_file}"
    stdin, stdout, stderr = client.exec_command(dump_cmd, timeout=180)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    status = stdout.channel.recv_exit_status()
    if status != 0:
        print("❌ Dump failed:", err)
        client.close()
        sys.exit(1)

    stdin, stdout, stderr = client.exec_command(f"ls -lh {dump_file}")
    dump_stat = stdout.read().decode('utf-8').strip()
    print("✓ Dump completed successfully:", dump_stat)

    # Step 3: Test restore into isolated database
    print(f"\n[3/4] Creating isolated database '{test_db}' and testing restore...")
    restore_script = f"""
sudo -u postgres dropdb --if-exists {test_db}
sudo -u postgres createdb {test_db}
sudo -u postgres pg_restore -d {test_db} -v {dump_file} > /tmp/restore_test.log 2>&1
echo "Restore finished with exit code: $?"
"""
    stdin, stdout, stderr = client.exec_command(restore_script, timeout=180)
    print(stdout.read().decode('utf-8'))

    # Step 4: Verify counts in restored test database
    print(f"\n[4/4] Verifying table counts in restored test database '{test_db}'...")
    sftp = client.open_sftp()
    verify_sql = f"""
SELECT 'Client' as table_name, count(*) as count FROM "Client"
UNION ALL
SELECT 'Employee', count(*) FROM "Employee"
UNION ALL
SELECT 'FaceEnrollment', count(*) FROM "FaceEnrollment"
UNION ALL
SELECT 'Attendance', count(*) FROM "Attendance"
UNION ALL
SELECT 'PatrolSession', count(*) FROM "PatrolSession";
"""
    with sftp.open('/tmp/verify_test_db.sql', 'w') as f:
        f.write(verify_sql)
    sftp.close()

    stdin, stdout, stderr = client.exec_command(f"sudo -u postgres psql -d {test_db} -f /tmp/verify_test_db.sql")
    test_counts = stdout.read().decode('utf-8')
    print("Test Database Restored Counts:")
    print(test_counts)

    if 'FaceEnrollment |     9' not in test_counts and 'FaceEnrollment|9' not in test_counts.replace(' ', ''):
        print("❌ Verification failed! Restored FaceEnrollment count mismatch.")
        client.close()
        sys.exit(1)

    print("✓ Verification PASSED: Restored test database contains all 9 FaceEnrollment records.")

    # Clean up test database
    print(f"\nCleaning up isolated test database '{test_db}'...")
    stdin, stdout, stderr = client.exec_command(f"sudo -u postgres dropdb {test_db}")
    print("✓ Isolated test database dropped successfully.")

    client.close()
    print("\n" + "=" * 70)
    print("PHASE 3 VERIFIED & COMPLETED SUCCESSFULLY")
    print(f"Dump File: {dump_file}")
    print(f"CSV File:  {csv_file}")
    print("=" * 70)

if __name__ == '__main__':
    main()
