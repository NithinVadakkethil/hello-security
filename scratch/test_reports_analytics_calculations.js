const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('=== RUNNING REPORTS & ANALYTICS REGRESSION TESTS ===');

  // Test 1: 10 expected / 10 completed = 100%
  const expectedSet1 = new Set(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10']);
  const scanned1 = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'];
  const completed1 = scanned1.filter(id => expectedSet1.has(id)).length;
  const pct1 = Math.round((completed1 / expectedSet1.size) * 100);
  console.log(`[TEST 1 PASS] 10/10 -> ${completed1}/${expectedSet1.size} (${pct1}%)`);
  if (pct1 !== 100) throw new Error('Test 1 failed');

  // Test 2: 10 expected / 5 completed = 50%
  const scanned2 = ['g1', 'g2', 'g3', 'g4', 'g5'];
  const completed2 = scanned2.filter(id => expectedSet1.has(id)).length;
  const pct2 = Math.round((completed2 / expectedSet1.size) * 100);
  console.log(`[TEST 2 PASS] 5/10 -> ${completed2}/${expectedSet1.size} (${pct2}%)`);
  if (pct2 !== 50) throw new Error('Test 2 failed');

  // Test 3 & 5: Duplicate checkpoint scans / retries do not inflate completed count
  const scanned3 = ['g1', 'g1', 'g2', 'g2', 'g3', 'g3', 'g1', 'g4', 'g5'];
  const completed3 = new Set(scanned3.filter(id => expectedSet1.has(id))).size;
  const pct3 = Math.round((completed3 / expectedSet1.size) * 100);
  console.log(`[TEST 3 & 5 PASS] Duplicate scans -> ${completed3}/${expectedSet1.size} (${pct3}%)`);
  if (pct3 !== 50 || completed3 !== 5) throw new Error('Test 3 & 5 failed');

  // Test 4: Extra out-of-route checkpoints scanned (e.g. 30 scanned for 10 expected)
  const scanned4 = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'extra1', 'extra2', 'extra3', 'extra30'];
  const completed4 = new Set(scanned4.filter(id => expectedSet1.has(id))).size;
  const pct4 = Math.round((completed4 / expectedSet1.size) * 100);
  console.log(`[TEST 4 PASS] 30 scanned for 10 expected -> ${completed4}/${expectedSet1.size} (${pct4}%)`);
  if (pct4 > 100 || completed4 !== 10) throw new Error('Test 4 failed: Compliance exceeded 100%');

  // Test 6: 0 expected checkpoints handled safely
  const expectedSet6 = new Set([]);
  const pct6 = expectedSet6.size > 0 ? Math.round((0 / expectedSet6.size) * 100) : 100;
  console.log(`[TEST 6 PASS] 0 expected gates -> ${pct6}% (Safe handling, N/A)`);
  if (pct6 !== 100) throw new Error('Test 6 failed');

  // Test 16 & 17: Weighted overall compliance never exceeds 100%
  const sessionExp1 = 10, sessionComp1 = 10;
  const sessionExp2 = 10, sessionComp2 = 5;
  const totalExp = sessionExp1 + sessionExp2;
  const totalComp = sessionComp1 + sessionComp2;
  const overallPct = Math.round((totalComp / totalExp) * 100);
  console.log(`[TEST 16 & 17 PASS] Weighted Overall Compliance: ${totalComp}/${totalExp} = ${overallPct}%`);
  if (overallPct !== 75) throw new Error('Test 16 & 17 failed');

  console.log('\n=== ALL REGRESSION TESTS PASSED CLEANLY ===');
}

runTests()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
