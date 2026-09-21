import { buildConsolidatedRouteCycleEmailHtml, buildPatrolCompletedEmailHtml } from '../api/src/common/email/templates/patrol-completed.template';

function runEmailTests() {
  // TEST 1: Full Patrol
  const test1Data = {
    routeName: 'Route Alpha',
    patrolCode: 'PAT-001',
    scannedCount: 3,
    totalCount: 3,
    compliancePercentage: 100,
    observationsCount: 0,
    completedAt: '10:45:00 PM',
    checkpoints: [
      { name: 'Showroom', sequence: 1, scannedAt: '10:42:28 PM', isScanned: true },
      { name: 'Basement', sequence: 2, scannedAt: '10:43:10 PM', isScanned: true },
      { name: 'Parts Room', sequence: 3, scannedAt: '10:44:00 PM', isScanned: true },
    ],
    observations: [],
  };

  const html1 = buildConsolidatedRouteCycleEmailHtml({
    officerName: 'Test Guard',
    employeeId: 'EMP-001',
    officerRole: 'SECURITY',
    siteName: 'Main Site',
    shiftName: 'Night Shift',
    cycleDate: '2026-09-18',
    assignedRoutesCount: 1,
    completedRoutesCount: 1,
    overallCompliancePercentage: 100,
    totalCheckpointsScanned: 3,
    totalCheckpointsCount: 3,
    totalObservationsCount: 0,
    routes: [test1Data],
  });

  if (!html1.includes('✓')) throw new Error('TEST 1: Should contain green checkmark');
  if (html1.includes('✕')) throw new Error('TEST 1: Should NOT contain red X mark');
  if (!html1.includes('3 / 3')) throw new Error('TEST 1: Progress 3 / 3');

  // Also test single patrol html builder
  const singleHtml1 = buildPatrolCompletedEmailHtml({
    patrolCode: 'PAT-001',
    officerName: 'Test Guard',
    employeeId: 'EMP-001',
    siteName: 'Main Site',
    routeName: 'Route Alpha',
    shiftName: 'Night Shift',
    startedAt: '10:00:00 PM',
    completedAt: '10:45:00 PM',
    scannedCount: 3,
    totalCount: 3,
    compliancePercentage: 100,
    observationsCount: 0,
    supervisorStatus: 'PENDING',
    checkpoints: test1Data.checkpoints,
    observations: [],
  });

  if (!singleHtml1.includes('✓')) throw new Error('TEST 1 Single: Should contain green checkmark');

  // TEST 2: Partial Patrol (5 expected, 3 scanned)
  const test2Data = {
    routeName: 'Route Beta',
    patrolCode: 'PAT-002',
    scannedCount: 3,
    totalCount: 5,
    compliancePercentage: 60,
    observationsCount: 0,
    completedAt: '11:15:00 PM',
    checkpoints: [
      { name: 'Showroom', sequence: 1, scannedAt: '11:02:28 PM', isScanned: true },
      { name: 'Basement', sequence: 2, scannedAt: '11:03:35 PM', isScanned: true },
      { name: 'Parking Area', sequence: 3, scannedAt: 'Not Scanned', isScanned: false },
      { name: 'Parts Room', sequence: 4, scannedAt: '11:05:44 PM', isScanned: true },
      { name: 'Fire Exit', sequence: 5, scannedAt: 'Not Scanned', isScanned: false },
    ],
    observations: [],
  };

  const html2 = buildConsolidatedRouteCycleEmailHtml({
    officerName: 'Test Guard',
    employeeId: 'EMP-001',
    officerRole: 'SECURITY',
    siteName: 'Main Site',
    shiftName: 'Night Shift',
    cycleDate: '2026-09-18',
    assignedRoutesCount: 1,
    completedRoutesCount: 1,
    overallCompliancePercentage: 60,
    totalCheckpointsScanned: 3,
    totalCheckpointsCount: 5,
    totalObservationsCount: 0,
    routes: [test2Data],
  });

  if (!html2.includes('✓')) throw new Error('TEST 2: Should contain green checkmark');
  if (!html2.includes('✕')) throw new Error('TEST 2: Should contain red X mark');
  if (!html2.includes('Not Scanned')) throw new Error('TEST 2: Should contain "Not Scanned"');
  if (!html2.includes('3 / 5')) throw new Error('TEST 2: Progress 3 / 5');
  if (!html2.includes('60%')) throw new Error('TEST 2: Compliance 60%');

  // TEST 3 & 4: Out of Route scans & Missed assigned checkpoint
  const test4Data = {
    routeName: 'Route Gamma',
    patrolCode: 'PAT-004',
    scannedCount: 2,
    totalCount: 3,
    compliancePercentage: 67,
    observationsCount: 0,
    completedAt: '11:30:00 PM',
    checkpoints: [
      { name: 'Checkpoint A', sequence: 1, scannedAt: '11:20:00 PM', isScanned: true },
      { name: 'Checkpoint B', sequence: 2, scannedAt: '11:22:00 PM', isScanned: true },
      { name: 'Checkpoint C', sequence: 3, scannedAt: 'Not Scanned', isScanned: false },
    ],
    observations: [],
  };

  const html4 = buildConsolidatedRouteCycleEmailHtml({
    officerName: 'Test Guard',
    employeeId: 'EMP-001',
    officerRole: 'SECURITY',
    siteName: 'Main Site',
    shiftName: 'Night Shift',
    cycleDate: '2026-09-18',
    assignedRoutesCount: 1,
    completedRoutesCount: 1,
    overallCompliancePercentage: 67,
    totalCheckpointsScanned: 2,
    totalCheckpointsCount: 3,
    totalObservationsCount: 0,
    routes: [test4Data],
  });

  if (!html4.includes('Checkpoint C')) throw new Error('TEST 4: Checkpoint C in HTML');
  if (!html4.includes('2 / 3')) throw new Error('TEST 4: Progress 2 / 3');
  if (!html4.includes('67%')) throw new Error('TEST 4: Compliance 67%');

  // TEST 8: Issue at Checkpoint
  const test8Data = {
    routeName: 'Route Delta',
    patrolCode: 'PAT-008',
    scannedCount: 1,
    totalCount: 1,
    compliancePercentage: 100,
    observationsCount: 1,
    completedAt: '11:45:00 PM',
    checkpoints: [
      { name: 'Main Gate', sequence: 1, scannedAt: '11:40:00 PM', isScanned: true },
    ],
    observations: [{ title: 'Checkpoint: Main Gate — Broken Lock', description: 'Lock broken on arrival' }],
  };

  const html8 = buildConsolidatedRouteCycleEmailHtml({
    officerName: 'Test Guard',
    employeeId: 'EMP-001',
    officerRole: 'SECURITY',
    siteName: 'Main Site',
    shiftName: 'Night Shift',
    cycleDate: '2026-09-18',
    assignedRoutesCount: 1,
    completedRoutesCount: 1,
    overallCompliancePercentage: 100,
    totalCheckpointsScanned: 1,
    totalCheckpointsCount: 1,
    totalObservationsCount: 1,
    routes: [test8Data],
  });

  if (!html8.includes('✓')) throw new Error('TEST 8: Scanned checkpoint shows green checkmark');
  if (!html8.includes('Broken Lock')) throw new Error('TEST 8: Observation rendered under observation summary');

  return 'ALL EMAIL MISSED CHECKPOINT UNIT TESTS PASSED SUCCESSFULLY!';
}

console.log(runEmailTests());
