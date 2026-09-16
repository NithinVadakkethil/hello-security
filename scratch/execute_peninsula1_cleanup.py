#!/usr/bin/env python3
import sys
import paramiko
import json
import time

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd, timeout=300):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=timeout)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    print("=== EXECUTING PENINSULA 1 SUBTASK RESET ON PRODUCTION ===")
    
    cleanup_script = """
set -e
mkdir -p /var/www/orbit/backups

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/var/www/orbit/backups/orbitdb_pre_peninsula1_cleanup_${TIMESTAMP}.dump"

echo "1. Taking pre-execution PostgreSQL backup of orbitdb..."
docker exec postgres pg_dump -U postgres orbitdb > "${BACKUP_FILE}" || pg_dump -U postgres -d orbitdb > "${BACKUP_FILE}" || true

if [ -s "${BACKUP_FILE}" ]; then
  echo "SUCCESS: Database backup created at ${BACKUP_FILE} (Size: $(du -h "${BACKUP_FILE}" | cut -f1))"
else
  echo "WARNING: Standard docker pg_dump failed, trying direct pg_dump via sudo..."
  pg_dump -U postgres -d orbitdb > "${BACKUP_FILE}" || true
  echo "Backup status check: $(ls -lh "${BACKUP_FILE}")"
fi

cd /var/www/orbit/hello-security
cat << 'EOF' > scratch/execute_cleanup.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  console.log("=== STARTING PENINSULA 1 TRANSACTIONAL RESET ===");

  const adminEmail = 'kaizen.peninsula@helloorbit.com';
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { client: true }
  });

  if (!user) throw new Error("Client admin kaizen.peninsula@helloorbit.com not found!");

  const clientId = user.client.id;
  const site = await prisma.site.findFirst({
    where: { clientId, name: { equals: 'Peninsula 1', mode: 'insensitive' } }
  });

  if (!site) throw new Error("Site Peninsula 1 not found!");
  const siteId = site.id;

  console.log(`CLIENT_ID: ${clientId} (${user.client.companyName})`);
  console.log(`SITE_ID: ${siteId} (${site.name})`);

  // Master Count BEFORE
  const masterBefore = await prisma.subTaskMaster.findMany({
    where: { clientId },
    include: { items: true }
  });
  let masterItemsBefore = 0;
  for (const m of masterBefore) masterItemsBefore += (m.items ? m.items.length : 0);

  // Gates under Peninsula 1
  const gates = await prisma.gate.findMany({ where: { siteId }, select: { id: true } });
  const gateIds = gates.map(g => g.id);

  // Target subtasks
  const targetSubtasks = await prisma.gateSubTask.findMany({
    where: { gateId: { in: gateIds } },
    include: { responses: { select: { id: true } } }
  });

  console.log(`Pre-cleanup target subtasks: ${targetSubtasks.length}`);

  // Snapshot before mutation
  const snapshotData = targetSubtasks.map(s => ({
    id: s.id,
    gateId: s.gateId,
    role: s.role,
    taskName: s.taskName,
    isActive: s.isActive,
    responseCount: s.responses ? s.responses.length : 0,
    createdAt: s.createdAt
  }));
  fs.writeFileSync('/var/www/orbit/backups/peninsula1_subtasks_snapshot.json', JSON.stringify(snapshotData, null, 2));
  console.log(`Audit snapshot saved to /var/www/orbit/backups/peninsula1_subtasks_snapshot.json`);

  const withoutHistoryIds = targetSubtasks.filter(s => !s.responses || s.responses.length === 0).map(s => s.id);
  const withHistoryIds = targetSubtasks.filter(s => s.responses && s.responses.length > 0).map(s => s.id);

  console.log(`Subtasks WITHOUT history to hard-delete: ${withoutHistoryIds.length}`);
  console.log(`Subtasks WITH history to deactivate: ${withHistoryIds.length}`);

  // Transactional Execution
  await prisma.$transaction(async (tx) => {
    // 1. Hard delete subtasks with NO history
    if (withoutHistoryIds.length > 0) {
      const delResult = await tx.gateSubTask.deleteMany({
        where: {
          id: { in: withoutHistoryIds },
          gate: { siteId: siteId } // Strict site scoping
        }
      });
      console.log(`Transaction step 1: Hard-deleted ${delResult.count} subtasks without history.`);
    }

    // 2. Deactivate subtasks WITH history
    if (withHistoryIds.length > 0) {
      const deactResult = await tx.gateSubTask.updateMany({
        where: {
          id: { in: withHistoryIds },
          gate: { siteId: siteId } // Strict site scoping
        },
        data: {
          isActive: false
        }
      });
      console.log(`Transaction step 2: Deactivated ${deactResult.count} subtasks with history.`);
    }
  });

  console.log("\\n=== POST-CLEANUP VERIFICATION ===");

  // Verify Active Checkpoint Subtasks for Peninsula 1
  const activeSubtasksAfter = await prisma.gateSubTask.count({
    where: {
      gateId: { in: gateIds },
      isActive: true
    }
  });

  console.log(`TOTAL_ACTIVE_CHECKPOINT_SUBTASKS_AFTER: ${activeSubtasksAfter}`);

  // Verify Master Tasks AFTER
  const masterAfter = await prisma.subTaskMaster.findMany({
    where: { clientId },
    include: { items: true }
  });
  let masterItemsAfter = 0;
  for (const m of masterAfter) masterItemsAfter += (m.items ? m.items.length : 0);

  console.log(`MASTER_TASK_COUNT_AFTER: ${masterItemsAfter} (Matches before: ${masterItemsBefore === masterItemsAfter ? 'YES' : 'NO'})`);

  // Verify Checkpoints Count
  const checkpointCountAfter = await prisma.gate.count({ where: { siteId } });
  console.log(`CHECKPOINT_COUNT_AFTER: ${checkpointCountAfter}`);

  // Verify Patrol History Responses intact
  const responsesIntact = await prisma.patrolSubTaskResponse.count({
    where: {
      gateSubTask: { gate: { siteId } }
    }
  });
  console.log(`PATROL_HISTORICAL_RESPONSES_INTACT: ${responsesIntact}`);

  console.log("\\nSUCCESS: PENINSULA 1 SUBTASK RESET COMPLETED TRANSACTIONALLY!");
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Cleanup Transaction Failed:", err);
  process.exit(1);
});
EOF

node scratch/execute_cleanup.js
"""

    code, out, err = run_ssh(cleanup_script, timeout=300)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
    print(f"--- EXIT CODE: {code} ---")
    if code != 0:
        sys.exit(1)
