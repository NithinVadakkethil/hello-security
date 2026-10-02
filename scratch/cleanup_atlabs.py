import subprocess

CLIENT_ID = "cmsh1eerr0009hpaxnr8dbvz4"
USER_ID = "cmsh1eert000bhpax3dspvcjs"

cleanup_sql = f"""
BEGIN;

-- 1. Refresh Tokens, Notifications & Audit Logs
DELETE FROM "RefreshToken" WHERE "userId" IN (SELECT id FROM "User" WHERE "clientId" = '{CLIENT_ID}');
DELETE FROM "NotificationDelivery" WHERE "clientId" = '{CLIENT_ID}';
DELETE FROM "NotificationRecipient" WHERE "settingsId" IN (SELECT id FROM "ClientNotificationSettings" WHERE "clientId" = '{CLIENT_ID}');
DELETE FROM "ClientNotificationSettings" WHERE "clientId" = '{CLIENT_ID}';
DELETE FROM "AuditLog" WHERE "userId" IN (SELECT id FROM "User" WHERE "clientId" = '{CLIENT_ID}') OR "clientId" = '{CLIENT_ID}';

-- 2. Snags & Maintenance
DELETE FROM "SnagHistory" WHERE "snagId" IN (SELECT id FROM "Snag" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}'));
DELETE FROM "SnagComment" WHERE "snagId" IN (SELECT id FROM "Snag" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}'));
DELETE FROM "SnagAssignment" WHERE "snagId" IN (SELECT id FROM "Snag" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}'));
DELETE FROM "Snag" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}');

-- 3. Incidents
DELETE FROM "Incident" WHERE "clientId" = '{CLIENT_ID}';

-- 4. Patrol Sessions & Checkpoints
DELETE FROM "PatrolSubTaskResponse" WHERE "patrolCheckpointId" IN (SELECT id FROM "PatrolCheckpoint" WHERE "patrolSessionId" IN (SELECT id FROM "PatrolSession" WHERE "clientId" = '{CLIENT_ID}'));
DELETE FROM "PatrolCheckpoint" WHERE "patrolSessionId" IN (SELECT id FROM "PatrolSession" WHERE "clientId" = '{CLIENT_ID}');
DELETE FROM "PatrolSession" WHERE "clientId" = '{CLIENT_ID}';

-- 5. Guard Assignments & Routes
DELETE FROM "GuardAssignment" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}');
DELETE FROM "PatrolRouteGate" WHERE "patrolRouteId" IN (SELECT id FROM "PatrolRoute" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}'));
DELETE FROM "PatrolRoute" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}');

-- 6. Gates & SubTasks
DELETE FROM "GateSubTask" WHERE "gateId" IN (SELECT id FROM "Gate" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}'));
DELETE FROM "Gate" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = '{CLIENT_ID}');

-- 7. Sites
DELETE FROM "Site" WHERE "clientId" = '{CLIENT_ID}';

-- 8. Face Enrollment
DELETE FROM "FaceEnrollment" WHERE "clientId" = '{CLIENT_ID}';

-- 9. Users (except admin@atlabs.ae) & Employees
DELETE FROM "User" WHERE "clientId" = '{CLIENT_ID}' AND id != '{USER_ID}';
UPDATE "User" SET "employeeId" = NULL WHERE id = '{USER_ID}';
DELETE FROM "Employee" WHERE "clientId" = '{CLIENT_ID}';

COMMIT;
"""

def run():
    print("Executing cleanup transaction on demoorbitdb...")
    cmd = ["sudo", "-u", "postgres", "psql", "-d", "demoorbitdb", "-c", cleanup_sql]
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("STDOUT:\n", res.stdout)
    print("STDERR:\n", res.stderr)
    if res.returncode == 0 and "COMMIT" in res.stdout:
        print("CLEANUP SUCCESSFUL AND COMMITTED!")
    else:
        print("CLEANUP FAILED!")

if __name__ == "__main__":
    run()
