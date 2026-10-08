import * as XLSX from 'xlsx';
import { prisma } from '../api/src/database/prisma';

async function testLiveApi() {
  const site = await prisma.site.findFirst({ where: { isActive: true } });
  if (!site) {
    console.error('No site found');
    return;
  }
  console.log(`Testing site: ${site.name} (${site.id})`);

  // Try to find a user to login and get token
  const user = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'CLIENT_ADMIN'] } },
  });

  if (!user) {
    console.error('No admin user found');
    return;
  }
  console.log(`User: ${user.email}`);

  // Test the service directly first
  const { siteImportService } = await import('../api/src/modules/site/site-import.service');
  const res = await siteImportService.generateTemplateBuffer(site.id);
  const wb = XLSX.read(res.buffer, { type: 'buffer' });
  const sheet = wb.Sheets['Checkpoints'];
  const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
  console.log('Direct Service Generated Headers:', headers);
}

testLiveApi();
