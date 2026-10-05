import { prisma } from '../api/src/database/prisma';
import { signAccessToken } from '../api/src/common/auth/jwt';
import axios from 'axios';

async function testRunningServer() {
  const user = await prisma.user.findUnique({
    where: { email: 'kaizen.legend@helloorbit.com' },
  });

  if (!user) {
    throw new Error('User kaizen.legend@helloorbit.com not found');
  }

  const token = signAccessToken({
    sub: user.id,
    tenantId: user.clientId,
    employeeId: user.employeeId,
    email: user.email,
    role: user.role,
    supervisedRole: user.supervisedRole || null,
  } as any);

  console.log(`Testing http://localhost:3001 with user ${user.email} (${user.role}), clientId: ${user.clientId}`);

  try {
    const resGet = await axios.get('http://localhost:3001/api/v1/checkpoint-categories', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('GET /api/v1/checkpoint-categories status:', resGet.status, resGet.data);

    const resDelete = await axios.delete('http://localhost:3001/api/v1/checkpoint-categories/sub-tasks/all', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('DELETE /api/v1/checkpoint-categories/sub-tasks/all status:', resDelete.status, resDelete.data);
  } catch (err: any) {
    console.error('Request failed:', err.response?.status, err.response?.data || err.message);
  }
}

testRunningServer().catch(console.error).finally(() => prisma.$disconnect());
