const axios = require('axios');

async function testMobileManagerFlow() {
  console.log('=== TESTING MANAGER MOBILE API FLOW ===\n');

  const BASE_URL = 'http://localhost:3001/api/v1';

  // 1. Manager Login
  console.log('[Step 1] Logging in as Manager (nithin@manager.com)...');
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'nithin@manager.com',
    password: 'OrbitManager@2026',
  });

  const { accessToken, user } = loginRes.data.data;
  console.log('✅ Login SUCCESS! User Role:', user.role);

  // 2. Fetch Assigned Organizations (GET /manager/clients)
  console.log('\n[Step 2] Fetching Assigned Organizations (GET /manager/clients)...');
  const clientsRes = await axios.get(`${BASE_URL}/manager/clients`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log('HTTP Status:', clientsRes.status);
  console.log('Response Payload:', JSON.stringify(clientsRes.data, null, 2));

  const clientList = clientsRes.data.data;
  console.log(`\n✅ Assigned Organizations Count: ${clientList.length}`);
  clientList.forEach((c, idx) => {
    console.log(`   ${idx + 1}. [${c.clientCode}] ${c.companyName} (${c.siteCount} Sites)`);
  });

  if (clientList.length > 0) {
    const selectedClient = clientList[0];
    console.log(`\n[Step 3] Fetching Sites for Selected Context (${selectedClient.companyName})...`);

    const sitesRes = await axios.get(`${BASE_URL}/manager/clients/${selectedClient.clientId}/sites`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-client-context': selectedClient.clientId,
      },
    });

    console.log('HTTP Status:', sitesRes.status);
    console.log('Sites Count:', sitesRes.data.data.length);
  }

  console.log('\n=== MANAGER MOBILE API FLOW TEST PASSED SUCCESSFULLY! ===');
}

testMobileManagerFlow().catch((err) => {
  console.error('❌ TEST FAILED:', err.response?.data || err.message);
  process.exit(1);
});
