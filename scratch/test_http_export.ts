import * as XLSX from 'xlsx';
import axios from 'axios';
import { prisma } from '../api/src/database/prisma';
import { signAccessToken } from '../api/src/common/auth/jwt';

async function testHttpExport() {
  try {
    const adminUser = await prisma.user.findFirst({
      where: { email: 'kaizen.legend@helloorbit.com' },
    });

    if (!adminUser) {
      console.error('User not found');
      return;
    }

    const token = signAccessToken({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      tenantId: adminUser.clientId || null,
      employeeId: adminUser.employeeId || null,
    });

    const site = await prisma.site.findFirst({ where: { clientId: adminUser.clientId } });
    console.log(`Downloading template for site: ${site?.name} (${site?.id})`);

    // Ensure a category is assigned to gate 1 for verification
    const gate1 = await prisma.gate.findFirst({ where: { siteId: site?.id } });
    const category = await prisma.checkpointCategory.findFirst({ where: { clientId: adminUser.clientId } });
    if (gate1 && category) {
      await prisma.gate.update({
        where: { id: gate1.id },
        data: { categoryId: category.id },
      });
      console.log(`Assigned category "${category.name}" to gate "${gate1.name}"`);
    }

    const res = await axios.get(`http://localhost:3001/api/v1/sites/${site?.id}/import-template`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer',
    });

    const wb = XLSX.read(Buffer.from(res.data), { type: 'buffer' });
    const sheet = wb.Sheets['Checkpoints'];
    const jsonRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log('\n--- LIVE HTTP EXPORT RESULT ---');
    console.log('Columns:  ', jsonRows[0].join(' | '));
    for (let i = 1; i <= Math.min(5, jsonRows.length - 1); i++) {
      console.log(`Row ${i}:    `, jsonRows[i].join(' | '));
    }
  } catch (err: any) {
    console.error('HTTP Test error:', err.message);
  }
}

testHttpExport();
