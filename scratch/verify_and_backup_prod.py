#!/usr/bin/env python3
import sys
import paramiko

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=60)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    verify_script = """
cd /var/www/orbit/hello-security
DB_URL=$(grep "DATABASE_URL" .env | cut -d'=' -f2- | tr -d '"')

echo "Database URL: ${DB_URL}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/var/www/orbit/backups/orbitdb_backup_peninsula1_post_reset_${TIMESTAMP}.sql"

echo "Taking full PostgreSQL database dump using DATABASE_URL..."
npx pg_dump "${DB_URL}" > "${BACKUP_FILE}" || pg_dump "${DB_URL}" > "${BACKUP_FILE}" || true

ls -lh "${BACKUP_FILE}"

cat << 'EOF' > scratch/verify_post_reset.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== COMPREHENSIVE POST-CLEANUP VERIFICATION ===");

  const adminEmail = 'kaizen.peninsula@helloorbit.com';
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { client: true }
  });

  const clientId = user.client.id;
  const site = await prisma.site.findFirst({
    where: { clientId, name: { equals: 'Peninsula 1', mode: 'insensitive' } }
  });

  const siteId = site.id;

  // 1. Check Active Subtasks for Peninsula 1
  const gates = await prisma.gate.findMany({ where: { siteId }, select: { id: true } });
  const gateIds = gates.map(g => g.id);

  const activeSubtasksCount = await prisma.gateSubTask.count({
    where: {
      gateId: { in: gateIds },
      isActive: true
    }
  });

  console.log(`CLIENT_NAME: ${user.client.companyName}`);
  console.log(`SITE_NAME: ${site.name}`);
  console.log(`TOTAL_CHECKPOINTS: ${gates.length}`);
  console.log(`TOTAL_ACTIVE_CHECKPOINT_SUBTASKS = ${activeSubtasksCount}`);

  // 2. Master Tasks Safety Check
  const master = await prisma.subTaskMaster.findMany({
    where: { clientId },
    include: { items: true }
  });

  const masterByRole = {};
  let totalMasterItems = 0;
  for (const m of master) {
    const count = m.items ? m.items.length : 0;
    masterByRole[m.role] = count;
    totalMasterItems += count;
  }

  console.log(`MASTER_TASK_COUNT_AFTER = ${totalMasterItems}`);
  console.log(`MASTER_BY_ROLE = ${JSON.stringify(masterByRole)}`);

  // 3. Historical Inspection Evidence
  const responsesCount = await prisma.patrolSubTaskResponse.count({
    where: { gateSubTask: { gate: { siteId } } }
  });
  console.log(`PATROL_HISTORICAL_RESPONSES_INTACT = ${responsesCount}`);

  // 4. Other Relations Safety Verification
  const observationsCount = await prisma.incident.count({ where: { clientId } });
  const snagsCount = await prisma.snag.count({ where: { clientId } });
  console.log(`OBSERVATIONS_COUNT_INTACT = ${observationsCount}`);
  console.log(`SNAGS_COUNT_INTACT = ${snagsCount}`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
EOF

node scratch/verify_post_reset.js
"""

    code, out, err = run_ssh(verify_script)
    print("--- STDOUT ---")
    print(out)
    if err:
        print("--- STDERR ---")
        print(err)
    print(f"--- EXIT CODE: {code} ---")
