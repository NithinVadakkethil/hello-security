import { createApp } from '../api/src/bootstrap/app';
import { prisma } from '../api/src/database/prisma';
import { signAccessToken } from '../api/src/common/auth/jwt';
import { UserRole } from '@prisma/client';
import axios from 'axios';
import http from 'http';

async function verifyExpressApp() {
  console.log('Testing Express App directly on port 3099...');
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(3099, () => {
      console.log('Test server listening on http://localhost:3099');
      resolve();
    });
  });

  try {
    // Find a test user with CLIENT_ADMIN or MANAGER role
    const user = await prisma.user.findFirst({
      where: {
        role: { in: [UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER] },
        isActive: true,
        clientId: { not: null },
      },
    });

    if (!user) {
      throw new Error('No admin user found for token generation');
    }

    const payload = {
      sub: user.id,
      tenantId: user.clientId,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
      supervisedRole: user.supervisedRole || null,
    };

    const token = signAccessToken(payload as any);

    console.log(`Using User: ${user.email} (${user.role}), Client: ${user.clientId}`);

    // Test 1: GET /api/v1/checkpoint-categories
    console.log('\n--- 1. Testing GET /api/v1/checkpoint-categories ---');
    const resGet = await axios.get('http://localhost:3099/api/v1/checkpoint-categories', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('GET status:', resGet.status, 'categories count:', resGet.data?.data?.length);

    // Test 2: DELETE /api/v1/checkpoint-categories/sub-tasks/all
    console.log('\n--- 2. Testing DELETE /api/v1/checkpoint-categories/sub-tasks/all ---');
    const resDeleteSubTasks = await axios.delete('http://localhost:3099/api/v1/checkpoint-categories/sub-tasks/all', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('DELETE /sub-tasks/all status:', resDeleteSubTasks.status, 'body:', resDeleteSubTasks.data);

    // Test 3: DELETE /api/v1/checkpoint-categories/subtasks/all (alias)
    console.log('\n--- 3. Testing DELETE /api/v1/checkpoint-categories/subtasks/all ---');
    const resDeleteSubtasks = await axios.delete('http://localhost:3099/api/v1/checkpoint-categories/subtasks/all', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('DELETE /subtasks/all status:', resDeleteSubtasks.status, 'body:', resDeleteSubtasks.data);

    console.log('\n=== ALL DIRECT EXPRESS ROUTE TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    server.close();
  }
}

verifyExpressApp()
  .catch((e) => {
    console.error('Express test failed:', e.response?.data || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
