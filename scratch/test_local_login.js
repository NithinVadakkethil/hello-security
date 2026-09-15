const axios = require('axios');

async function testLogin(email, password) {
  try {
    const res = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email,
      password,
    });
    console.log(`✅ Login SUCCESS for ${email}:`, res.data);
  } catch (err) {
    console.error(`❌ Login FAILED for ${email}:`, err.response?.data || err.message);
  }
}

async function run() {
  await testLogin('nithin@manager.com', 'OrbitManager@2026');
  await testLogin('mohan@vespa.com', '3b3079aacfb2');
  await testLogin('nithin@vespa.com', 'a16e1c7f2cdc');
}

run();
