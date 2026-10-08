import * as XLSX from 'xlsx';
import { prisma } from '../api/src/database/prisma';
import { siteImportService } from '../api/src/modules/site/site-import.service';
import { checkpointCategoryService } from '../api/src/modules/checkpoint-category/checkpoint-category.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

async function runExportTests() {
  console.log('=== TEST SUITE: SITE CHECKPOINT EXPORT WITH CATEGORY / UTILITY ===\n');

  // Setup test client & site
  const testClient = await prisma.client.findFirst({
    where: { isActive: true },
    include: { sites: true },
  });

  if (!testClient || testClient.sites.length === 0) {
    console.error('No test client/site found in local database.');
    process.exit(1);
  }

  const clientId = testClient.id;
  const site = testClient.sites[0];
  const siteId = site.id;
  console.log(`Using Test Client: ${testClient.companyName} (${clientId})`);
  console.log(`Using Test Site: ${site.name} (${siteId})\n`);

  // Ensure categories exist
  const existingCategories = await checkpointCategoryService.list(clientId);
  let garbageCat = existingCategories.find((c) => c.normalizedName === 'garbage');
  if (!garbageCat) {
    garbageCat = await checkpointCategoryService.create(clientId, { name: 'Garbage', description: 'Waste management' });
  }
  let electricalCat = existingCategories.find((c) => c.normalizedName === 'electrical');
  if (!electricalCat) {
    electricalCat = await checkpointCategoryService.create(clientId, { name: 'Electrical', description: 'Power rooms' });
  }
  let poolCat = existingCategories.find((c) => c.normalizedName === 'swimming pool');
  if (!poolCat) {
    poolCat = await checkpointCategoryService.create(clientId, { name: 'Swimming Pool', description: 'Pool facilities' });
  }

  // Create temporary test gates
  const timestamp = Date.now();
  const testGateGarbage1 = await prisma.gate.create({
    data: {
      siteId,
      gateCode: `TEST-EXP-G1-${timestamp}`,
      qrCode: `TEST-EXP-G1-${timestamp}`,
      name: `Export Test Garbage 1 ${timestamp}`,
      description: 'Ground Floor',
      sequence: 901,
      latitude: 25.1234,
      longitude: 55.1234,
      categoryId: garbageCat.id,
    },
  });

  const testGateGarbage2 = await prisma.gate.create({
    data: {
      siteId,
      gateCode: `TEST-EXP-G2-${timestamp}`,
      qrCode: `TEST-EXP-G2-${timestamp}`,
      name: `Export Test Garbage 2 ${timestamp}`,
      description: 'Basement 1',
      sequence: 902,
      categoryId: garbageCat.id,
    },
  });

  const testGateElectrical = await prisma.gate.create({
    data: {
      siteId,
      gateCode: `TEST-EXP-E1-${timestamp}`,
      qrCode: `TEST-EXP-E1-${timestamp}`,
      name: `Export Test Electrical ${timestamp}`,
      description: 'Floor 1',
      sequence: 903,
      latitude: 25.1245,
      longitude: 55.1245,
      categoryId: electricalCat.id,
    },
  });

  const testGatePool = await prisma.gate.create({
    data: {
      siteId,
      gateCode: `TEST-EXP-P1-${timestamp}`,
      qrCode: `TEST-EXP-P1-${timestamp}`,
      name: `Export Test Pool ${timestamp}`,
      description: 'Roof Deck',
      sequence: 904,
      categoryId: poolCat.id,
    },
  });

  const testGateNoCat = await prisma.gate.create({
    data: {
      siteId,
      gateCode: `TEST-EXP-NC-${timestamp}`,
      qrCode: `TEST-EXP-NC-${timestamp}`,
      name: `Export Test No Category ${timestamp}`,
      description: 'Main Entrance',
      sequence: 905,
      categoryId: null,
    },
  });

  console.log('Created test checkpoints for export verification.\n');

  try {
    // -------------------------------------------------------------
    // TEST 1 — Generate Export Buffer for Site
    // -------------------------------------------------------------
    console.log('--- Test 1 & Verification of Export File Buffer ---');
    const { buffer, checkpointCount } = await siteImportService.generateTemplateBuffer(siteId);
    assert(buffer != null && buffer.length > 0, `Export buffer generated (${buffer.length} bytes)`);
    assert(checkpointCount >= 5, `Export contains checkpoints count (${checkpointCount})`);

    // Parse generated Excel workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    assert(workbook.SheetNames.includes('Checkpoints'), 'Workbook contains "Checkpoints" worksheet');

    const sheet = workbook.Sheets['Checkpoints'];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);
    console.log(`Parsed ${rows.length} rows from exported Excel sheet.`);

    const headers: string[] = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[];
    console.log('Export Column Headers:', headers);

    assert(headers.includes('Category / Utility'), 'Header contains "Category / Utility" column');
    assert(headers.includes('Checkpoint Name'), 'Header contains "Checkpoint Name" column');
    assert(headers.includes('Sequence Number'), 'Header contains "Sequence Number" column');
    assert(headers.includes('Floor'), 'Header contains "Floor" column');
    assert(headers.includes('Latitude'), 'Header contains "Latitude" column');
    assert(headers.includes('Longitude'), 'Header contains "Longitude" column');

    // -------------------------------------------------------------
    // TEST 2 — Categorized Checkpoint & Multiple Checkpoints using same Category
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Categorized Checkpoints with Same Category ("Garbage") ---');
    const rowG1 = rows.find((r) => r['Checkpoint Name'] === testGateGarbage1.name);
    const rowG2 = rows.find((r) => r['Checkpoint Name'] === testGateGarbage2.name);

    assert(rowG1 != null, 'Export contains Garbage Gate 1');
    assert(rowG1['Category / Utility'] === 'Garbage', `Garbage Gate 1 Category / Utility is "Garbage" (got "${rowG1['Category / Utility']}")`);
    assert(rowG1['Floor'] === 'Ground Floor', 'Garbage Gate 1 Floor is "Ground Floor"');
    assert(rowG1['Sequence Number'] === 901, 'Garbage Gate 1 Sequence Number is 901');

    assert(rowG2 != null, 'Export contains Garbage Gate 2');
    assert(rowG2['Category / Utility'] === 'Garbage', `Garbage Gate 2 Category / Utility is "Garbage" (got "${rowG2['Category / Utility']}")`);

    // -------------------------------------------------------------
    // TEST 3 — Different Categories
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Checkpoints with Different Categories ---');
    const rowE = rows.find((r) => r['Checkpoint Name'] === testGateElectrical.name);
    const rowP = rows.find((r) => r['Checkpoint Name'] === testGatePool.name);

    assert(rowE != null, 'Export contains Electrical Gate');
    assert(rowE['Category / Utility'] === 'Electrical', `Electrical Gate Category / Utility is "Electrical" (got "${rowE['Category / Utility']}")`);

    assert(rowP != null, 'Export contains Swimming Pool Gate');
    assert(rowP['Category / Utility'] === 'Swimming Pool', `Pool Gate Category / Utility is "Swimming Pool" (got "${rowP['Category / Utility']}")`);

    // -------------------------------------------------------------
    // TEST 4 — Checkpoint with No Category (null)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Checkpoint with No Category ---');
    const rowNC = rows.find((r) => r['Checkpoint Name'] === testGateNoCat.name);
    assert(rowNC != null, 'Export contains No Category Gate');
    const catVal = rowNC['Category / Utility'];
    assert(catVal === undefined || catVal === '' || catVal === '-', `Uncategorized checkpoint exported cleanly without null/undefined/object artifacts (got "${catVal}")`);
    assert(typeof catVal !== 'object', 'Category / Utility is not an object');
    assert(catVal !== 'undefined' && catVal !== 'null' && catVal !== '[object Object]', 'No stringified undefined/null/[object Object]');

    // -------------------------------------------------------------
    // TEST 5 — QR Codes & Checkpoint Identity untouched
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Verify Checkpoint QR & Identity Untouched ---');
    const dbGateAfter = await prisma.gate.findUnique({
      where: { id: testGateGarbage1.id },
      include: { category: true },
    });
    assert(dbGateAfter?.qrCode === testGateGarbage1.qrCode, 'Checkpoint QR code is untouched');
    assert(dbGateAfter?.gateCode === testGateGarbage1.gateCode, 'Checkpoint gateCode is untouched');
    assert(dbGateAfter?.sequence === testGateGarbage1.sequence, 'Checkpoint sequence is untouched');
    assert(dbGateAfter?.categoryId === garbageCat.id, 'Checkpoint category relation is untouched');

    console.log('\n🎉 ALL SITE CHECKPOINT EXPORT TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup test gates
    await prisma.gate.deleteMany({
      where: {
        id: {
          in: [
            testGateGarbage1.id,
            testGateGarbage2.id,
            testGateElectrical.id,
            testGatePool.id,
            testGateNoCat.id,
          ],
        },
      },
    });
  }
}

runExportTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
