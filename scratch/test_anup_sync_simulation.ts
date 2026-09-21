import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

async function main() {
  const email = 'anup.peninsula1@helloorbit.com';

  const user = await prisma.user.findFirst({
    where: { email },
    include: { employee: true },
  });

  const loginRes = await axios.post(`${API_URL}/auth/login`, {
    email: user?.email,
    password: 'Password123!',
  });
  const token = loginRes.data.data.accessToken;

  // Complete session cmuav50u4004nutqqxxz88yde
  console.log('Completing active session cmuav50u4004nutqqxxz88yde...');
  const completeRes = await axios.patch(
    `${API_URL}/patrol-sessions/cmuav50u4004nutqqxxz88yde/complete`,
    { remarks: 'Completed test patrol' },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  console.log('Session completed successfully:', completeRes.data?.data?.status);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
