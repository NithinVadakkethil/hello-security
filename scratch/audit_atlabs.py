import subprocess

CLIENT_ID = "cmsh1eerr0009hpaxnr8dbvz4"
USER_ID = "cmsh1eert000bhpax3dspvcjs"

def run_psql(sql):
    cmd = ["sudo", "-u", "postgres", "psql", "-d", "demoorbitdb", "-t", "-A", "-c", sql]
    res = subprocess.run(cmd, capture_output=True, text=True)
    val = res.stdout.strip()
    return int(val) if val.isdigit() else (val if val != "" else "0")

print("--- CLIENT INFORMATION ---")
print("Client Record:", run_psql(f'SELECT id || \'|\' || "companyName" || \'|\' || "clientCode" || \'|\' || email FROM "Client" WHERE id = \'{CLIENT_ID}\';'))
print("All Users under Client:", run_psql(f'SELECT COUNT(*) FROM "User" WHERE "clientId" = \'{CLIENT_ID}\';'))

print("\n--- TENANT BUSINESS RECORD AUDIT ---")
queries = {
    "Users (Total under client)": f'SELECT COUNT(*) FROM "User" WHERE "clientId" = \'{CLIENT_ID}\'',
    "Users (Admin preserved)": f'SELECT COUNT(*) FROM "User" WHERE "clientId" = \'{CLIENT_ID}\' AND id = \'{USER_ID}\'',
    "Users (Other users to delete)": f'SELECT COUNT(*) FROM "User" WHERE "clientId" = \'{CLIENT_ID}\' AND id != \'{USER_ID}\'',
    "Employees": f'SELECT COUNT(*) FROM "Employee" WHERE "clientId" = \'{CLIENT_ID}\'',
    "Sites": f'SELECT COUNT(*) FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\'',
    "Gates": f'SELECT COUNT(*) FROM "Gate" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\')',
    "GateSubTasks": f'SELECT COUNT(*) FROM "GateSubTask" WHERE "gateId" IN (SELECT id FROM "Gate" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\'))',
    "PatrolRoutes": f'SELECT COUNT(*) FROM "PatrolRoute" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\')',
    "PatrolRouteGates": f'SELECT COUNT(*) FROM "PatrolRouteGate" WHERE "routeId" IN (SELECT id FROM "PatrolRoute" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\'))',
    "GuardAssignments": f'SELECT COUNT(*) FROM "GuardAssignment" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\')',
    "PatrolSessions": f'SELECT COUNT(*) FROM "PatrolSession" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\')',
    "PatrolCheckpoints": f'SELECT COUNT(*) FROM "PatrolCheckpoint" WHERE "sessionId" IN (SELECT id FROM "PatrolSession" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\'))',
    "PatrolSubTaskResponses": f'SELECT COUNT(*) FROM "PatrolSubTaskResponse" WHERE "checkpointId" IN (SELECT id FROM "PatrolCheckpoint" WHERE "sessionId" IN (SELECT id FROM "PatrolSession" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\')))',
    "Attendance": f'SELECT COUNT(*) FROM "Attendance" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\') OR "employeeId" IN (SELECT id FROM "Employee" WHERE "clientId" = \'{CLIENT_ID}\')',
    "Incidents": f'SELECT COUNT(*) FROM "Incident" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\')',
    "Snags": f'SELECT COUNT(*) FROM "Snag" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\')',
    "SnagAssignments": f'SELECT COUNT(*) FROM "SnagAssignment" WHERE "snagId" IN (SELECT id FROM "Snag" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\'))',
    "SnagComments": f'SELECT COUNT(*) FROM "SnagComment" WHERE "snagId" IN (SELECT id FROM "Snag" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\'))',
    "SnagHistory": f'SELECT COUNT(*) FROM "SnagHistory" WHERE "snagId" IN (SELECT id FROM "Snag" WHERE "siteId" IN (SELECT id FROM "Site" WHERE "clientId" = \'{CLIENT_ID}\'))',
    "FaceEnrollment": f'SELECT COUNT(*) FROM "FaceEnrollment" WHERE "employeeId" IN (SELECT id FROM "Employee" WHERE "clientId" = \'{CLIENT_ID}\') OR "createdById" = \'{USER_ID}\'',
    "NotificationDelivery": f'SELECT COUNT(*) FROM "NotificationDelivery" WHERE "recipientId" IN (SELECT id FROM "NotificationRecipient" WHERE "userId" IN (SELECT id FROM "User" WHERE "clientId" = \'{CLIENT_ID}\'))',
    "NotificationRecipient": f'SELECT COUNT(*) FROM "NotificationRecipient" WHERE "userId" IN (SELECT id FROM "User" WHERE "clientId" = \'{CLIENT_ID}\')',
    "ClientNotificationSettings": f'SELECT COUNT(*) FROM "ClientNotificationSettings" WHERE "clientId" = \'{CLIENT_ID}\'',
    "RefreshToken": f'SELECT COUNT(*) FROM "RefreshToken" WHERE "userId" IN (SELECT id FROM "User" WHERE "clientId" = \'{CLIENT_ID}\')',
}

for name, sql in queries.items():
    cnt = run_psql(sql)
    print(f"{name}: {cnt}")
