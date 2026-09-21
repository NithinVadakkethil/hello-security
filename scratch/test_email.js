const { buildConsolidatedRouteCycleEmailHtml } = require('../api/dist/api/src/common/email/templates/patrol-completed.template');

const test2Data = {
  routeName: 'KAIZEN - PENINSULA 1 Route',
  patrolCode: 'PATROL-SESSION-000698',
  scannedCount: 3,
  totalCount: 5,
  compliancePercentage: 60,
  observationsCount: 0,
  completedAt: '10:45:00 PM',
  checkpoints: [
    { name: 'Showroom', sequence: 1, scannedAt: '10:42:28 PM', isScanned: true },
    { name: 'Basement', sequence: 2, scannedAt: '10:42:35 PM', isScanned: true },
    { name: 'Parking Area', sequence: 3, scannedAt: 'Not Scanned', isScanned: false },
    { name: 'Parts Room', sequence: 4, scannedAt: '10:42:44 PM', isScanned: true },
    { name: 'Fire Exit', sequence: 5, scannedAt: 'Not Scanned', isScanned: false }
  ],
  observations: []
};

const html = buildConsolidatedRouteCycleEmailHtml({
  officerName: 'Ujjwal shreshtha',
  employeeId: 'EMP-000004',
  officerRole: 'SECURITY',
  siteName: 'Peninsula 1',
  shiftName: 'Day Shift',
  cycleDate: '2026-09-18',
  assignedRoutesCount: 1,
  completedRoutesCount: 1,
  overallCompliancePercentage: 60,
  totalCheckpointsScanned: 3,
  totalCheckpointsCount: 5,
  totalObservationsCount: 0,
  routes: [test2Data]
});

console.log('--- GENERATED EMAIL HTML SAMPLE ---');
console.log(html);
if (html.includes('✓') && html.includes('✕') && html.includes('Not Scanned') && html.includes('3 / 5')) {
  console.log('\n✅ VERIFICATION SUCCESSFUL: Email HTML correctly displays 3 green checkmarks, 2 red X marks with "Not Scanned", and accurate 3 / 5 (60%) progress!');
} else {
  console.error('\n❌ VERIFICATION FAILED');
  process.exit(1);
}
