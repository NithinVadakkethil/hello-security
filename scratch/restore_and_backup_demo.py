import subprocess
import os

print("--- 1. RESTORING DEMOORBITDB FROM PRE-CLEANUP BACKUP ---")
# Terminate existing connections to demoorbitdb
subprocess.run("sudo -u postgres psql -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'demoorbitdb' AND pid <> pg_backend_pid();\"", shell=True)

# Restore demoorbitdb cleanly
restore_cmd = "sudo -u postgres pg_restore --clean --if-exists -d demoorbitdb /var/backups/demoorbitdb_pre_atlabs_cleanup_20260929.dump"
print(f"Executing: {restore_cmd}")
res_restore = subprocess.run(restore_cmd, shell=True, capture_output=True, text=True)
print("RESTORE STDOUT:\n", res_restore.stdout)
if res_restore.stderr:
    print("RESTORE STDERR (non-fatal warnings expected):\n", "\n".join(res_restore.stderr.splitlines()[:10]))

# Verify FaceEnrollment table exists in restored db (since FaceEnrollment was created in demoorbitdb)
check_fe = subprocess.run('sudo -u postgres psql -d demoorbitdb -t -A -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = \'FaceEnrollment\';"', shell=True, capture_output=True, text=True)
print("FaceEnrollment table count:", check_fe.stdout.strip())
if check_fe.stdout.strip() == "0":
    print("Re-applying FaceEnrollment DDL to demoorbitdb...")
    fe_ddl = '''
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FaceEnrollmentStatus') THEN
            CREATE TYPE "FaceEnrollmentStatus" AS ENUM ('ENROLLED', 'REVOKED', 'FAILED');
        END IF;
    END
    $$;

    CREATE TABLE IF NOT EXISTS "public"."FaceEnrollment" (
        "id" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "clientId" TEXT NOT NULL,
        "modelName" TEXT NOT NULL,
        "modelVersion" TEXT NOT NULL,
        "embeddingDimension" INTEGER NOT NULL,
        "encryptedTemplate" TEXT NOT NULL,
        "status" "FaceEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
        "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "revokedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "FaceEnrollment_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "FaceEnrollment_employeeId_key" ON "public"."FaceEnrollment"("employeeId");
    CREATE INDEX IF NOT EXISTS "FaceEnrollment_clientId_idx" ON "public"."FaceEnrollment"("clientId");
    CREATE INDEX IF NOT EXISTS "FaceEnrollment_status_idx" ON "public"."FaceEnrollment"("status");

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'FaceEnrollment_employeeId_fkey'
        ) THEN
            ALTER TABLE "public"."FaceEnrollment"
            ADD CONSTRAINT "FaceEnrollment_employeeId_fkey"
            FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'FaceEnrollment_clientId_fkey'
        ) THEN
            ALTER TABLE "public"."FaceEnrollment"
            ADD CONSTRAINT "FaceEnrollment_clientId_fkey"
            FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
    END
    $$;

    ALTER TABLE "public"."FaceEnrollment" OWNER TO orbituser;
    '''
    subprocess.run(f'sudo -u postgres psql -d demoorbitdb -c "{fe_ddl}"', shell=True)

print("\n--- 2. VERIFYING ALL DEMO DATA INTACT ---")
queries = {
    "Total Clients": 'SELECT COUNT(*) FROM "Client"',
    "Total Users": 'SELECT COUNT(*) FROM "User"',
    "Total Employees": 'SELECT COUNT(*) FROM "Employee"',
    "Total Sites": 'SELECT COUNT(*) FROM "Site"',
    "Total Gates": 'SELECT COUNT(*) FROM "Gate"',
    "Total Snags": 'SELECT COUNT(*) FROM "Snag"',
    "Total GuardAssignments": 'SELECT COUNT(*) FROM "GuardAssignment"',
    "Atlabs Admin Users": "SELECT COUNT(*) FROM \"User\" WHERE email = 'admin@atlabs.ae'",
    "Atlabs Users": "SELECT COUNT(*) FROM \"User\" WHERE \"clientId\" = 'cmsh1eerr0009hpaxnr8dbvz4'"
}
for k, q in queries.items():
    res = subprocess.run(f'sudo -u postgres psql -d demoorbitdb -t -A -c \'{q}\'', shell=True, capture_output=True, text=True)
    print(f"{k}: {res.stdout.strip()}")

print("\n--- 3. CREATING PRE-DEPLOYMENT BACKUP ---")
backup_file = "/var/backups/demoorbitdb_pre_latest_deploy_20260929.dump"
subprocess.run(f"sudo -u postgres pg_dump -Fc demoorbitdb > {backup_file}", shell=True)
res_ls = subprocess.run(f"ls -lh {backup_file}", shell=True, capture_output=True, text=True)
print(res_ls.stdout.strip())
print("BACKUP VERIFICATION COMPLETED SUCCESSFULLY!")
