#!/usr/bin/env python3
import sys
import paramiko
import json

HOST = '194.76.27.3'
PORT = 22
USER = 'root'
PASSWORD = '@.Pd4j4p0c@O0FE123'

def run_ssh(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, out, err
    finally:
        client.close()

if __name__ == '__main__':
    inspect_script = """
cd /var/www/orbit/hello-security
cat << 'EOF' > scratch/dry_run_peninsula.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== SUMMARY HEADER ===");

  // 1. Resolve Client Admin
  const adminEmail = 'kaizen.peninsula@helloorbit.com';
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { client: true }
  });

  if (!user) {
    console.error(`ERROR: Client Admin ${adminEmail} not found!`);
    process.exit(1);
  }

  const client = user.client;
  const clientId = client.id;
  console.log(`CLIENT_ID: ${clientId}`);
  console.log(`CLIENT_NAME: ${client.companyName} (${client.clientCode})`);
  console.log(`ADMIN_EMAIL: ${adminEmail}`);

  // 2. Resolve Site = Peninsula 1
  const site = await prisma.site.findFirst({
    where: {
      clientId: clientId,
      name: { equals: 'Peninsula 1', mode: 'insensitive' }
    }
  });

  if (!site) {
    console.error(`ERROR: Site Peninsula 1 not found under client ${clientId}!`);
    process.exit(1);
  }

  const siteId = site.id;
  console.log(`SITE_ID: ${siteId}`);
  console.log(`SITE_NAME: ${site.name} (${site.siteCode})`);

  // 3. Resolve Other Site for Cross-Site Verification
  const otherSite = await prisma.site.findFirst({
    where: {
      clientId: clientId,
      id: { not: siteId }
    }
  });

  let otherSiteCount = 0;
  if (otherSite) {
    const otherGates = await prisma.gate.findMany({ where: { siteId: otherSite.id }, select: { id: true } });
    const otherGateIds = otherGates.map(g => g.id);
    otherSiteCount = await prisma.gateSubTask.count({ where: { gateId: { in: otherGateIds } } });
    console.log(`OTHER_SITE_NAME: ${otherSite.name} (${otherSite.siteId || otherSite.id})`);
    console.log(`OTHER_SITE_SUBTASK_COUNT_BEFORE: ${otherSiteCount}`);
  }

  // 4. Resolve Gates under Peninsula 1
  const gates = await prisma.gate.findMany({
    where: { siteId: siteId },
    orderBy: { sequence: 'asc' }
  });

  console.log(`TOTAL_CHECKPOINTS: ${gates.length}`);

  const gateIds = gates.map(g => g.id);

  // 5. Total GateSubTasks targeted
  const allSubtasks = await prisma.gateSubTask.findMany({
    where: { gateId: { in: gateIds } },
    include: {
      responses: { select: { id: true } }
    }
  });

  const totalGateSubtasks = allSubtasks.length;
  const activeGateSubtasks = allSubtasks.filter(s => s.isActive).length;
  const inactiveGateSubtasks = allSubtasks.filter(s => !s.isActive).length;

  const withHistory = allSubtasks.filter(s => s.responses && s.responses.length > 0).length;
  const withoutHistory = allSubtasks.filter(s => !s.responses || s.responses.length === 0).length;

  console.log(`TOTAL_GATE_SUBTASKS: ${totalGateSubtasks}`);
  console.log(`ACTIVE_GATE_SUBTASKS: ${activeGateSubtasks}`);
  console.log(`INACTIVE_GATE_SUBTASKS: ${inactiveGateSubtasks}`);
  console.log(`GATE_SUBTASKS_WITH_HISTORY: ${withHistory}`);
  console.log(`GATE_SUBTASKS_WITHOUT_HISTORY: ${withoutHistory}`);

  // 6. Master Task Safety Check
  const master = await prisma.subTaskMaster.findMany({
    where: { clientId: clientId },
    include: { items: true }
  });

  let totalMasterItems = 0;
  const masterByRole = {};
  for (const m of master) {
    const count = m.items ? m.items.length : 0;
    masterByRole[m.role] = count;
    totalMasterItems += count;
  }

  console.log(`MASTER_TASK_COUNT_BEFORE: ${totalMasterItems}`);
  console.log(`MASTER_BY_ROLE: ${JSON.stringify(masterByRole)}`);

  // 7. Checkpoint-by-checkpoint breakdown
  console.log("\\n--- CHECKPOINT BREAKDOWN ---");
  const checkpointDetails = [];
  for (const gate of gates) {
    const subtasks = await prisma.gateSubTask.findMany({
      where: { gateId: gate.id },
      include: { responses: { select: { id: true } } }
    });

    const activeCount = subtasks.filter(s => s.isActive).length;
    const inactiveCount = subtasks.filter(s => !s.isActive).length;
    const totalCount = subtasks.length;

    const rolesCount = {};
    for (const st of subtasks) {
      rolesCount[st.role] = (rolesCount[st.role] || 0) + 1;
    }

    checkpointDetails.push({
      gateId: gate.id,
      gateCode: gate.gateCode,
      name: gate.name,
      sequence: gate.sequence,
      activeSubtasks: activeCount,
      inactiveSubtasks: inactiveCount,
      totalSubtasks: totalCount,
      roles: rolesCount,
      subtasks: subtasks.map(st => ({
        id: st.id,
        taskName: st.taskName,
        role: st.role,
        isActive: st.isActive,
        hasHistory: st.responses && st.responses.length > 0,
        responseCount: st.responses ? st.responses.length : 0
      }))
    });
  }

  console.log(JSON.stringify(checkpointDetails, null, 2));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Dry run script error:", err);
  process.exit(1);
});
EOF

cd /var/www/orbit/hello-security
node scratch/dry_run_peninsula.js
"""

    code, out, err = run_ssh(inspect_script)
    print("--- STDOUT ---")
    print(out)
    if err:
      print("--- STDERR ---")
      print(err)
    print(f"--- EXIT CODE: {code} ---")
