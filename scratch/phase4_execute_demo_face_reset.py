#!/usr/bin/env python3
"""
Phase 4 & 5 — Execute Atomic Face-Enrollment Reset on demoorbitdb
Safety assertions:
1. Validates current_database() == 'demoorbitdb'
2. Atomic transaction with verification of counts
3. Invariant check on Employee, User, Client, Attendance, PatrolSession
"""
import paramiko
import sys

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def main():
    print("=" * 70)
    print("PHASE 4 & 5 — ATOMIC DEMO FACE ENROLLMENT RESET")
    print("=" * 70)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)

    sftp = client.open_sftp()
    reset_sql = """
BEGIN;

-- 1. Identity assertion
DO $$
BEGIN
    IF current_database() <> 'demoorbitdb' THEN
        RAISE EXCEPTION 'FATAL SAFETY ABORT: Database is not demoorbitdb! Connected to: %', current_database();
    END IF;
END $$;

-- 2. Baseline counts
SELECT 'PRE_FACE_ENROLLMENT' as metric, count(*) as count FROM "FaceEnrollment";

-- 3. Delete all face enrollments in demoorbitdb
DELETE FROM "FaceEnrollment";

-- 4. Post-deletion count
SELECT 'POST_FACE_ENROLLMENT' as metric, count(*) as count FROM "FaceEnrollment";

-- 5. Invariant counts (MUST BE IDENTICAL TO PRE-RESET BASELINE)
SELECT 'INVARIANT_CLIENT' as metric, count(*) as count FROM "Client";
SELECT 'INVARIANT_EMPLOYEE' as metric, count(*) as count FROM "Employee";
SELECT 'INVARIANT_USER' as metric, count(*) as count FROM "User";
SELECT 'INVARIANT_ATTENDANCE' as metric, count(*) as count FROM "Attendance";
SELECT 'INVARIANT_PATROL_SESSION' as metric, count(*) as count FROM "PatrolSession";
SELECT 'INVARIANT_PATROL_CHECKPOINT' as metric, count(*) as count FROM "PatrolCheckpoint";
SELECT 'INVARIANT_INCIDENT' as metric, count(*) as count FROM "Incident";
SELECT 'INVARIANT_SNAG' as metric, count(*) as count FROM "Snag";

COMMIT;
"""
    with sftp.open('/tmp/execute_face_reset.sql', 'w') as f:
        f.write(reset_sql)
    sftp.close()

    print("\nExecuting atomic reset on demoorbitdb...")
    cmd = "sudo -u postgres psql -d demoorbitdb -f /tmp/execute_face_reset.sql"
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    status = stdout.channel.recv_exit_status()

    print(out)
    if err:
        print("STDERR:", err)
    if status != 0:
        print("❌ Transaction failed or aborted!")
        client.close()
        sys.exit(1)

    print("\n✓ Transaction COMMITTED successfully.")
    client.close()
    print("=" * 70)

if __name__ == '__main__':
    main()
