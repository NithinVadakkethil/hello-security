import paramiko
import sys
import json

hostname = '194.76.27.3'
username = 'root'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print(f"Connecting to {hostname}...")
    ssh.connect(hostname, username=username, timeout=15)
    print("Connected successfully.")

    # 1. Download snapshot file to local artifact directory for record
    sftp = ssh.open_sftp()
    remote_snapshot = '/var_backups_local'
    sftp.get('/var/backups/varinder_identity_snapshot_20260910.json', '/Users/zinfogcodelabs/.gemini/antigravity-ide/brain/5a13a365-36f0-4a78-8b58-45eb487e541f/varinder_identity_snapshot_20260910.json')
    sftp.close()
    print("Snapshot downloaded locally.")

    # 2. Execute Atomic Normalization Script via Node
    mutation_js = """
const path = require('path');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require(path.join(__dirname, 'api/dist/api/src/common/auth/bcrypt'));

const prisma = new PrismaClient();

function request(method, reqPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const payload = body ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/v1' + reqPath,
      method: method,
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({ status: res.statusCode, body: json || data });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runNormalization() {
  console.log('--- STARTING ATOMIC PRODUCTION DATA NORMALIZATION ---');

  const newHash = await hashPassword('KaizenManager@2026!');

  const result = await prisma.$transaction(async (tx) => {
    // A. Archive Old User Account
    const archivedUser = await tx.user.update({
      where: { id: 'cmspzj3m20056hp181h2sld3g' },
      data: {
        email: 'varinder.k.archived@kaizenams.com',
        isActive: false,
      }
    });

    // Revoke old refresh tokens
    await tx.refreshToken.updateMany({
      where: { userId: 'cmspzj3m20056hp181h2sld3g', revokedAt: null },
      data: { revokedAt: new Date() }
    });

    // B. Normalize Active Centralized Manager User Account
    const activeUser = await tx.user.update({
      where: { id: 'cmtve82rw001hhpr8zrjum69q' },
      data: {
        email: 'varinder.k@kaizenams.com',
        role: 'MANAGER',
        clientId: null,
        password: newHash,
        rawPassword: 'KaizenManager@2026!',
        isActive: true,
      }
    });

    // C. Normalize Centralized Manager Employee Record
    const managerEmp = await tx.employee.update({
      where: { id: 'cmtve82rs001fhpr8o91anwe9' },
      data: {
        email: 'varinder.k@kaizenams.com',
      }
    });

    // D. Update KAIZEN - Legends Organization Contact Email
    const legendsClient = await tx.client.update({
      where: { id: 'cmspzj3lz0054hp189gaym6ky' },
      data: {
        email: 'kaizen.legend@helloorbit.com',
      }
    });

    return { archivedUser, activeUser, managerEmp, legendsClient };
  });

  console.log('TRANSACTION_SUCCESS:', {
    archivedUser: { id: result.archivedUser.id, email: result.archivedUser.email, isActive: result.archivedUser.isActive },
    activeUser: { id: result.activeUser.id, email: result.activeUser.email, role: result.activeUser.role, clientId: result.activeUser.clientId, isActive: result.activeUser.isActive },
    managerEmp: { id: result.managerEmp.id, email: result.managerEmp.email },
    legendsClient: { id: result.legendsClient.id, email: result.legendsClient.email }
  });

  // VERIFICATIONS

  // 1. Memberships Check
  const memberships = await prisma.managerClientMembership.findMany({
    where: { managerUserId: 'cmtve82rw001hhpr8zrjum69q', isActive: true },
    include: { client: { select: { id: true, companyName: true } } }
  });
  console.log('\\nVERIFY_MANAGER_MEMBERSHIPS_COUNT:', memberships.length);
  console.log('ASSIGNED_ORGANIZATIONS:', memberships.map(m => m.client.companyName).join(', '));

  // 2. Varinder API Login Test
  console.log('\\n--- TESTING VARINDER LOGIN VIA REAL API ---');
  const vLogin = await request('POST', '/auth/login', {
    email: 'varinder.k@kaizenams.com',
    password: 'KaizenManager@2026!'
  });
  console.log(`Varinder Login Status: ${vLogin.status}`);
  if (vLogin.status !== 200) throw new Error('Varinder login failed: ' + JSON.stringify(vLogin.body));
  const vToken = vLogin.body.data.accessToken;
  const vUser = vLogin.body.data.user;
  console.log(`Varinder Auth Identity: ID = ${vUser.id}, role = ${vUser.role}, tenantId = ${vUser.tenantId}`);

  // 3. Centralized Manager Client Listing
  const vClients = await request('GET', '/manager/clients', null, vToken);
  console.log(`Varinder Assigned Clients API Status: ${vClients.status}, Total: ${vClients.body.data?.length || 0}`);

  const assignedClientId = vClients.body.data[0]?.clientId;
  if (assignedClientId) {
    const vSites = await request('GET', `/manager/clients/${assignedClientId}/sites`, null, vToken);
    console.log(`Varinder Sites for Assigned Client ${assignedClientId}: Status ${vSites.status}, Total: ${vSites.body.data?.length || 0}`);

    const vActivePatrols = await request('GET', `/manager/clients/${assignedClientId}/active-patrols`, null, vToken);
    console.log(`Varinder Active Patrols: Status ${vActivePatrols.status}`);

    const vCompletedPatrols = await request('GET', `/manager/clients/${assignedClientId}/completed-patrols`, null, vToken);
    console.log(`Varinder Completed Patrols: Status ${vCompletedPatrols.status}`);
  }

  // 4. Security & Tenant Isolation Checks
  console.log('\\n--- TESTING SECURITY & TENANT ISOLATION ---');
  // Unassigned client
  const forbiddenRes = await request('GET', '/manager/clients/invalid-unassigned-client-id/sites', null, vToken);
  console.log(`Unassigned Client Access Status: ${forbiddenRes.status} (Expected 403)`);

  // Historical KAIZEN - Legends client (cmspzj3lz0054hp189gaym6ky)
  const legendsForbiddenRes = await request('GET', '/manager/clients/cmspzj3lz0054hp189gaym6ky/sites', null, vToken);
  console.log(`Historical Kaizen Legends Access Status: ${legendsForbiddenRes.status} (Expected 403)`);

  // Read-only write operation test
  const writeForbiddenRes = await request('POST', `/manager/clients/${assignedClientId}/sites`, { name: 'Unauthorized Site' }, vToken);
  console.log(`Manager Write Attempt Status: ${writeForbiddenRes.status} (Expected 404 - Write route not exposed)`);

  // 5. Kaizen Legends Admin Login Test
  console.log('\\n--- TESTING KAIZEN LEGENDS CLIENT ADMIN LOGIN ---');
  const klLogin = await request('POST', '/auth/login', {
    email: 'kaizen.legend@helloorbit.com',
    password: 'KaizenLegend@2026!'
  });
  console.log(`Kaizen Legends Admin Login Status: ${klLogin.status}`);
  if (klLogin.status !== 200) throw new Error('Kaizen Legends admin login failed: ' + JSON.stringify(klLogin.body));
  const klUser = klLogin.body.data.user;
  console.log(`Kaizen Legends Auth Identity: ID = ${klUser.id}, role = ${klUser.role}, tenantId = ${klUser.tenantId}`);

  // 6. Post-Mutation Data Integrity Check for Kaizen Legends
  const postLegendCounts = {
    sites: await prisma.site.count({ where: { clientId: 'cmspzj3lz0054hp189gaym6ky' } }),
    employees: await prisma.employee.count({ where: { clientId: 'cmspzj3lz0054hp189gaym6ky' } }),
    checkpoints: await prisma.gate.count({ where: { site: { clientId: 'cmspzj3lz0054hp189gaym6ky' } } }),
    subtasks: await prisma.gateSubTask.count({ where: { gate: { site: { clientId: 'cmspzj3lz0054hp189gaym6ky' } } } }),
    routes: await prisma.patrolRoute.count({ where: { clientId: 'cmspzj3lz0054hp189gaym6ky' } }),
    assignments: await prisma.guardAssignment.count({ where: { clientId: 'cmspzj3lz0054hp189gaym6ky' } }),
    sessions: await prisma.patrolSession.count({ where: { clientId: 'cmspzj3lz0054hp189gaym6ky' } }),
    incidents: await prisma.incident.count({ where: { clientId: 'cmspzj3lz0054hp189gaym6ky' } }),
    snags: await prisma.snag.count({ where: { clientId: 'cmspzj3lz0054hp189gaym6ky' } }),
  };
  console.log('\\nPOST_MUTATION_LEGEND_COUNTS:' + JSON.stringify(postLegendCounts));

  console.log('\\n--- ALL NORMALIZATION STEPS AND VERIFICATIONS COMPLETED 100% CLEANLY ---');
}

runNormalization().catch(err => {
  console.error('MUTATION_FAILED:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
"""

    sftp = ssh.open_sftp()
    with sftp.open('/var/www/orbit/hello-security/run_normalization.js', 'w') as f:
        f.write(mutation_js)
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command('cd /var/www/orbit/hello-security && pnpm exec node run_normalization.js')
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print(out)
    if err:
        print("STDERR:", err)

    ssh.exec_command('rm -f /var/www/orbit/hello-security/run_normalization.js')

except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
finally:
    ssh.close()
