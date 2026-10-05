import axios from 'axios';

async function testAll() {
  try {
    const health = await axios.get('http://localhost:3001/api/v1/health');
    console.log('Health status:', health.status, health.data);
  } catch (e: any) {
    console.log('Health error:', e.response?.status, e.response?.data);
  }

  try {
    const cats = await axios.get('http://localhost:3001/api/v1/checkpoint-categories');
    console.log('Cats status:', cats.status, cats.data);
  } catch (e: any) {
    console.log('Cats error:', e.response?.status, e.response?.data);
  }
}

testAll();
