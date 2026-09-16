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
    inspect_script = """
cd /var/www/orbit/hello-security
cat << 'EOF' > scratch/summary_peninsula.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'kaizen.peninsula@helloorbit.com';
  const user = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { client: true }
  });

  const client = user.client;
  const clientId = client.id;

  const sites = await prisma.site.findMany({ where: { clientId } });
  
  const siteDetails = [];
  for (const s of sites) {
    const gates = await prisma.gate.findMany({ where: { siteId: s.id }, select: { id: true } });
    const gateIds = gates.map(g => g.id);
    const subtaskCount = await prisma.gateSubTask.count({ where: { gateId: { in: gateIds } } });
    siteDetails.push({ siteId: s.id, siteName: s.name, siteCode: s.siteCode, checkpointCount: gates.length, gateSubTaskCount: subtaskCount });
  }

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

  const peninsulaSite = sites.find(s => s.name.toLowerCase().includes('peninsula 1'));
  const peninsulaGates = await prisma.gate.findMany({ where: { siteId: peninsulaSite.id }, select: { id: true } });
  const peninsulaGateIds = peninsulaGates.map(g => g.id);
  const allSubtasks = await prisma.gateSubTask.findMany({
    where: { gateId: { in: peninsulaGateIds } },
    include: { responses: { select: { id: true } } }
  });

  const totalGateSubtasks = allSubtasks.length;
  const activeGateSubtasks = allSubtasks.filter(s => s.isActive).length;
  const inactiveGateSubtasks = allSubtasks.filter(s => !s.isActive).length;
  const withHistory = allSubtasks.filter(s => s.responses && s.responses.length > 0).length;
  const withoutHistory = allSubtasks.filter(s => !s.responses || s.responses.length === 0).length;

  const rolesCount = {};
  for (const st of allSubtasks) {
    rolesCount[st.role] = (rolesCount[st.role] || 0) + 1;
  }

  console.log(JSON.stringify({
    clientId,
    clientName: client.companyName,
    clientCode: client.clientCode,
    adminEmail,
    peninsulaSiteId: peninsulaSite.id,
    peninsulaSiteName: peninsulaSite.name,
    totalCheckpoints: peninsulaGates.length,
    totalGateSubtasks,
    activeGateSubtasks,
    inactiveGateSubtasks,
    withHistory,
    withoutHistory,
    rolesCount,
    masterTaskCount: totalMasterItems,
    masterByRole,
    sites: siteDetails
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
EOF

node scratch/summary_peninsula.js
"""
    code, out, err = run_ssh(inspect_script)
    print(out)
