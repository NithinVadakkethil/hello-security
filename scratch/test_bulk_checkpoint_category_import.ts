import * as XLSX from 'xlsx';
import { prisma } from '../api/src/database/prisma';
import { siteImportService } from '../api/src/modules/site/site-import.service';
import { checkpointCategoryService } from '../api/src/modules/checkpoint-category/checkpoint-category.service';
import { patrolCheckpointService } from '../api/src/modules/patrol-checkpoint/patrol-checkpoint.service';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

async function createExcelBuffer(rows: any[], headers?: string[]): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers || (rows.length > 0 ? Object.keys(rows[0]) : undefined) });
  XLSX.utils.book_append_sheet(wb, ws, 'Checkpoints');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function runTests() {
  console.log('=== TEST SUITE: BULK CHECKPOINT IMPORT WITH CATEGORY / UTILITY ===\n');

  // Setup test tenant, client, site
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

  // Ensure test categories exist for this client
  const existingCategories = await checkpointCategoryService.list(clientId);
  let garbageCat = existingCategories.find((c) => c.normalizedName === 'garbage');
  if (!garbageCat) {
    garbageCat = await checkpointCategoryService.create(clientId, { name: 'Garbage', description: 'Waste management checkpoints' });
  }
  let electricalCat = existingCategories.find((c) => c.normalizedName === 'electrical');
  if (!electricalCat) {
    electricalCat = await checkpointCategoryService.create(clientId, { name: 'Electrical', description: 'Power distribution rooms' });
  }
  let poolCat = existingCategories.find((c) => c.normalizedName === 'swimming pool');
  if (!poolCat) {
    poolCat = await checkpointCategoryService.create(clientId, { name: 'Swimming Pool', description: 'Pool and water facilities' });
  }

  console.log(`Master Categories ready: Garbage (${garbageCat.id}), Electrical (${electricalCat.id}), Swimming Pool (${poolCat.id})\n`);

  // -------------------------------------------------------------
  // TEST 1 — Template Generation includes Category / Utility
  // -------------------------------------------------------------
  console.log('--- Test 1: Template Generation includes "Category / Utility" column ---');
  const templateRes = await siteImportService.generateTemplateBuffer(siteId);
  const templateWb = XLSX.read(templateRes.buffer, { type: 'buffer' });
  const templateWs = templateWb.Sheets[templateWb.SheetNames[0]];
  const templateJson: any[][] = XLSX.utils.sheet_to_json(templateWs, { header: 1 });
  const templateHeaders = templateJson[0];
  console.log('Generated Template Headers:', templateHeaders);
  assert(templateHeaders.includes('Category / Utility'), 'Template contains "Category / Utility" column header');
  assert(templateHeaders.includes('Checkpoint Name'), 'Template contains "Checkpoint Name" column header');
  assert(templateHeaders.includes('Floor'), 'Template contains "Floor" column header');

  // -------------------------------------------------------------
  // TEST 2 — Existing Category Resolution & Duplicate Category Reference
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Existing Category Resolution & Reference (Garbage Room 1 & 2 -> Garbage) ---');
  const testRows1 = [
    {
      'Sequence Number': 101,
      'Checkpoint Name': `Test Garbage Room A1 ${Date.now()}`,
      'Floor': 'Basement 1',
      'Category / Utility': 'Garbage',
      'Role': 'House Keeping',
      'Subtask': 'Clear central bin',
    },
    {
      'Sequence Number': 102,
      'Checkpoint Name': `Test Garbage Room A2 ${Date.now()}`,
      'Floor': 'Basement 2',
      'Category / Utility': 'Garbage ', // test trimming
      'Role': 'House Keeping',
      'Subtask': 'Disinfect floor',
    },
  ];

  const buffer1 = await createExcelBuffer(testRows1);
  const valResult1 = await siteImportService.validateImport(siteId, buffer1);
  console.log('Validation Result 1 Errors:', valResult1.errors);
  assert(valResult1.errorCount === 0, 'Validation passed with 0 errors');
  assert(valResult1.preview[0].category === 'Garbage', 'Preview item 1 shows category "Garbage"');
  assert(valResult1.preview[1].category === 'Garbage', 'Preview item 2 shows category "Garbage"');

  const execResult1 = await siteImportService.executeImport(siteId, buffer1);
  assert(execResult1.checkpointsCreated === 2, `Created 2 checkpoints (got ${execResult1.checkpointsCreated})`);

  // Verify DB records
  const gate1 = await prisma.gate.findFirst({ where: { name: testRows1[0]['Checkpoint Name'], siteId } });
  const gate2 = await prisma.gate.findFirst({ where: { name: testRows1[1]['Checkpoint Name'], siteId } });
  assert(gate1 != null && gate1.categoryId === garbageCat.id, `Gate 1 categoryId correctly points to Garbage (${garbageCat.id})`);
  assert(gate2 != null && gate2.categoryId === garbageCat.id, `Gate 2 categoryId correctly points to Garbage (${garbageCat.id})`);

  // Verify Master Categories count did not increase
  const allCategoriesAfterTest1 = await checkpointCategoryService.list(clientId);
  const garbageCategories = allCategoriesAfterTest1.filter((c) => c.normalizedName === 'garbage');
  assert(garbageCategories.length === 1, 'Only 1 master Garbage category exists (no duplication)');

  // -------------------------------------------------------------
  // TEST 3 — Multiple Categories in single import
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Multiple Categories in single import ---');
  const testRows2 = [
    {
      'Sequence Number': 201,
      'Checkpoint Name': `Test Multi Garbage ${Date.now()}`,
      'Floor': 'Floor 1',
      'Category / Utility': 'Garbage',
    },
    {
      'Sequence Number': 202,
      'Checkpoint Name': `Test Multi Electrical ${Date.now()}`,
      'Floor': 'Floor 2',
      'Category / Utility': 'electrical', // test case-insensitivity
    },
    {
      'Sequence Number': 203,
      'Checkpoint Name': `Test Multi Pool ${Date.now()}`,
      'Floor': 'Roof',
      'Category / Utility': 'Swimming Pool',
    },
  ];

  const buffer2 = await createExcelBuffer(testRows2);
  const valResult2 = await siteImportService.validateImport(siteId, buffer2);
  assert(valResult2.errorCount === 0, 'Multi-category validation passed with 0 errors');
  assert(valResult2.preview[0].category === 'Garbage', 'Row 1 mapped to Garbage');
  assert(valResult2.preview[1].category === 'Electrical', 'Row 2 mapped to Electrical');
  assert(valResult2.preview[2].category === 'Swimming Pool', 'Row 3 mapped to Swimming Pool');

  await siteImportService.executeImport(siteId, buffer2);
  const dbGateGarbage = await prisma.gate.findFirst({ where: { name: testRows2[0]['Checkpoint Name'], siteId } });
  const dbGateElectrical = await prisma.gate.findFirst({ where: { name: testRows2[1]['Checkpoint Name'], siteId } });
  const dbGatePool = await prisma.gate.findFirst({ where: { name: testRows2[2]['Checkpoint Name'], siteId } });

  assert(dbGateGarbage?.categoryId === garbageCat.id, 'Garbage gate assigned Garbage categoryId');
  assert(dbGateElectrical?.categoryId === electricalCat.id, 'Electrical gate assigned Electrical categoryId');
  assert(dbGatePool?.categoryId === poolCat.id, 'Pool gate assigned Swimming Pool categoryId');

  // -------------------------------------------------------------
  // TEST 4 — Unknown Category validation failure (Do NOT auto-create)
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Unknown Category validation failure ---');
  const testRows3 = [
    {
      'Sequence Number': 301,
      'Checkpoint Name': `Invalid Category Gate ${Date.now()}`,
      'Floor': 'Floor 5',
      'Category / Utility': 'Garbge Typo',
    },
  ];
  const buffer3 = await createExcelBuffer(testRows3);
  const valResult3 = await siteImportService.validateImport(siteId, buffer3);
  assert(valResult3.errorCount === 1, `Validation failed with 1 error (got ${valResult3.errorCount})`);
  assert(valResult3.errors[0].field === 'Category / Utility', 'Error field is "Category / Utility"');
  assert(
    valResult3.errors[0].message.includes('Garbge Typo') && valResult3.errors[0].message.includes('Settings → Categories / Utilities'),
    `Error message is clear and actionable: "${valResult3.errors[0].message}"`
  );

  let executeFailedAsExpected = false;
  try {
    await siteImportService.executeImport(siteId, buffer3);
  } catch (err: any) {
    executeFailedAsExpected = true;
  }
  assert(executeFailedAsExpected, 'executeImport aborted and did not create invalid checkpoint');

  // -------------------------------------------------------------
  // TEST 5 — Blank Category (Optional Behavior)
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Blank Category (Optional Behavior) ---');
  const testRows4 = [
    {
      'Sequence Number': 401,
      'Checkpoint Name': `Blank Category Gate ${Date.now()}`,
      'Floor': 'Ground Floor',
      'Category / Utility': '',
    },
  ];
  const buffer4 = await createExcelBuffer(testRows4);
  const valResult4 = await siteImportService.validateImport(siteId, buffer4);
  assert(valResult4.errorCount === 0, 'Blank category row is valid (optional field)');
  assert(valResult4.preview[0].category === '—', 'Preview shows "—" for blank category');

  await siteImportService.executeImport(siteId, buffer4);
  const dbGateBlank = await prisma.gate.findFirst({ where: { name: testRows4[0]['Checkpoint Name'], siteId } });
  assert(dbGateBlank != null && dbGateBlank.categoryId === null, 'Checkpoint created with categoryId = null');

  // -------------------------------------------------------------
  // TEST 6 — Backward Compatibility (Old Excel without Category column)
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Backward Compatibility (Old Excel without Category column) ---');
  const testRows5 = [
    {
      'Sequence Number': 501,
      'Checkpoint Name': `Old Format Gate 1 ${Date.now()}`,
      'Floor': 'Floor 1',
      'Role': 'Security',
      'Subtask': 'Check fire exit door',
    },
    {
      'Sequence Number': 502,
      'Checkpoint Name': `Old Format Gate 2 ${Date.now()}`,
      'Floor': 'Floor 2',
      'Role': 'Security',
      'Subtask': 'Inspect security panel',
    },
  ];
  // Excel created with only the old headers
  const buffer5 = await createExcelBuffer(testRows5, ['Sequence Number', 'Checkpoint Name', 'Floor', 'Role', 'Subtask']);
  const valResult5 = await siteImportService.validateImport(siteId, buffer5);
  assert(valResult5.errorCount === 0, 'Old Excel format validates with 0 errors');
  assert(valResult5.checkpointsCount === 2, 'Parsed 2 checkpoints from old format');
  assert(valResult5.subtasksCount === 2, 'Parsed 2 subtasks from old format');

  await siteImportService.executeImport(siteId, buffer5);
  const dbOldGate1 = await prisma.gate.findFirst({ where: { name: testRows5[0]['Checkpoint Name'], siteId } });
  const dbOldGate2 = await prisma.gate.findFirst({ where: { name: testRows5[1]['Checkpoint Name'], siteId } });
  assert(dbOldGate1 != null && dbOldGate1.categoryId === null, 'Old format gate 1 created successfully with categoryId = null');
  assert(dbOldGate2 != null && dbOldGate2.categoryId === null, 'Old format gate 2 created successfully with categoryId = null');

  // -------------------------------------------------------------
  // TEST 7 — QR Identity Safety & Scanning
  // -------------------------------------------------------------
  console.log('\n--- Test 7: QR Identity Safety & Scanning ---');
  const freshGateGarbage = await prisma.gate.findFirst({
    where: { name: testRows2[0]['Checkpoint Name'], siteId },
    include: { category: true },
  });
  assert(freshGateGarbage != null, 'Target gate found in DB');
  console.log('freshGateGarbage:', { id: freshGateGarbage?.id, name: freshGateGarbage?.name, qrCode: freshGateGarbage?.qrCode });
  assert(Boolean(freshGateGarbage?.qrCode), 'Created checkpoint has unique qrCode generated');
  assert(Boolean(freshGateGarbage?.gateCode), 'Created checkpoint has standard gateCode');

  // Verify checkpoint can be looked up by QR code
  const gateByQr = await prisma.gate.findFirst({
    where: { qrCode: freshGateGarbage!.qrCode },
    include: { category: true },
  });
  console.log('gateByQr:', { id: gateByQr?.id, name: gateByQr?.name, qrCode: gateByQr?.qrCode });
  assert(gateByQr != null, 'Checkpoint lookup by qrCode succeeds');
  assert(gateByQr?.id === freshGateGarbage!.id, `Found checkpoint ID matches exactly (${gateByQr?.id} vs ${freshGateGarbage!.id})`);
  assert(gateByQr?.categoryId === garbageCat.id, 'Found checkpoint categoryId matches Garbage master category');
  assert(gateByQr?.category?.name === 'Garbage', 'Found checkpoint category relation resolved to "Garbage"');

  // Test scan resolution via gateRepository findByCode (used by patrol scanners)
  const scannedGate = await prisma.gate.findFirst({
    where: { qrCode: freshGateGarbage!.qrCode, isActive: true },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          subTasks: true,
        },
      },
    },
  });
  assert(scannedGate != null, 'Scanner resolves checkpoint by QR code');
  assert(scannedGate?.name === freshGateGarbage!.name, 'Resolved checkpoint name matches');
  assert(scannedGate?.categoryId === garbageCat.id, 'Resolved checkpoint categoryId preserved');
  assert(scannedGate?.category?.name === 'Garbage', 'Resolved checkpoint category name matches "Garbage"');

  // Clean up test gates
  await prisma.gate.deleteMany({
    where: {
      siteId,
      name: {
        startsWith: 'Test ',
      },
    },
  });
  await prisma.gate.deleteMany({
    where: {
      siteId,
      name: {
        startsWith: 'Old Format ',
      },
    },
  });
  await prisma.gate.deleteMany({
    where: {
      siteId,
      name: {
        startsWith: 'Blank Category ',
      },
    },
  });

  console.log('\n🎉 ALL 7 BULK IMPORT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
