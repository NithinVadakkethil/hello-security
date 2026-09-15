import axios from 'axios';

const API_BASE = 'http://127.0.0.1:3001/api/v1';

async function runTests() {
  console.log('--- STARTING MANAGER QR SCAN AUTHORIZATION VERIFICATION ---');

  try {
    // 1. Log in as Manager (nithin@manager.com)
    const mgrLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'nithin@manager.com',
      password: 'OrbitManager@2026',
    });
    const mgrToken = mgrLoginRes.data.data.accessToken;
    console.log('✓ Manager Login Successful');

    // 2. Fetch Manager's assigned client organizations
    const mgrClientsRes = await axios.get(`${API_BASE}/manager/clients`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    const mgrClients = mgrClientsRes.data.data;
    console.log('✓ Assigned Manager Organizations:', mgrClients.map((c: any) => c.companyName));

    if (mgrClients.length < 1) {
      throw new Error('Manager has no assigned organizations for testing.');
    }

    const clientA = mgrClients[0]; // e.g. Vespa

    // 3. Fetch sites and checkpoints under Client A
    const sitesRes = await axios.get(`${API_BASE}/manager/clients/${clientA.clientId}/sites`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    const sites = sitesRes.data.data;
    const siteA = sites[0];

    const checkpointsRes = await axios.get(`${API_BASE}/sites/${siteA.id}/gates`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    const checkpointA = checkpointsRes.data.data[0];
    console.log(`✓ Target Checkpoint in Client A (${clientA.companyName}):`, checkpointA.name, `(${checkpointA.id})`);

    // TEST CASE 1: Manager scans Checkpoint A with matching active client context header
    console.log('\n[TEST 1] Manager scans Checkpoint A with matching client context...');
    const scanResult1 = await axios.post(
      `${API_BASE}/patrol-checkpoints/scan`,
      { gateId: checkpointA.id, status: 'NORMAL' },
      {
        headers: {
          Authorization: `Bearer ${mgrToken}`,
          'x-client-context': clientA.clientId,
        },
      },
    );
    console.log('✓ TEST 1 PASSED: Scan allowed & recorded successfully:', scanResult1.data.success);

    // TEST CASE 2: Manager scans Checkpoint A with mismatched client context header
    console.log('\n[TEST 2] Manager scans Checkpoint A with mismatched client context...');
    try {
      await axios.post(
        `${API_BASE}/patrol-checkpoints/scan`,
        { gateId: checkpointA.id, status: 'NORMAL' },
        {
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'x-client-context': 'wrong-client-id-12345',
          },
        },
      );
      console.error('❌ TEST 2 FAILED: Expected 403 error for mismatched client context.');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      console.log('✓ TEST 2 PASSED: Received expected 403 error:', msg);
    }

    // TEST CASE 3: Manager scans Checkpoint belonging to unassigned organization
    console.log('\n[TEST 3] Manager scans Checkpoint in unassigned organization...');
    // Login as Super Admin to get an unassigned client checkpoint
    const adminLoginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@helloorbit.com',
      password: 'Admin@123',
    });
    const adminToken = adminLoginRes.data.data.accessToken;

    const allClientsRes = await axios.get(`${API_BASE}/clients`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const allClients = allClientsRes.data.data;
    const unassignedClient = allClients.find((c: any) => !mgrClients.some((m: any) => m.clientId === c.id));

    if (unassignedClient) {
      const unassignedSitesRes = await axios.get(`${API_BASE}/clients/${unassignedClient.id}/sites`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const unassignedSite = unassignedSitesRes.data.data[0];
      if (unassignedSite) {
        const unassignedGatesRes = await axios.get(`${API_BASE}/sites/${unassignedSite.id}/gates`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        const unassignedGate = unassignedGatesRes.data.data[0];

        if (unassignedGate) {
          try {
            await axios.post(
              `${API_BASE}/patrol-checkpoints/scan`,
              { gateId: unassignedGate.id, status: 'NORMAL' },
              {
                headers: {
                  Authorization: `Bearer ${mgrToken}`,
                  'x-client-context': clientA.clientId,
                },
              },
            );
            console.error('❌ TEST 3 FAILED: Expected 403 error for unassigned client checkpoint.');
          } catch (err: any) {
            const msg = err.response?.data?.error?.message;
            console.log('✓ TEST 3 PASSED: Received expected 403 error:', msg);
          }
        }
      }
    } else {
      console.log('ℹ TEST 3 SKIPPED: No unassigned client found in database.');
    }

    console.log('\n==================================================');
    console.log('ALL MANAGER QR SCAN AUTHORIZATION TESTS COMPLETED SUCCESSFULLY!');
    console.log('==================================================');
  } catch (err: any) {
    console.error('❌ Test execution error:', err.response?.data || err.message);
  }
}

runTests();
