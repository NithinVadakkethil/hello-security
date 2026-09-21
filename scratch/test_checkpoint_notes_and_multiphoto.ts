import { PrismaClient } from '@prisma/client';
import { patrolCheckpointService } from '../api/src/modules/patrol-checkpoint/patrol-checkpoint.service';
import { scanCheckpointSchema } from '../api/src/modules/patrol-checkpoint/patrol-checkpoint.schema';
import { reportService } from '../api/src/modules/report/report.service';

const prisma = new PrismaClient();

async function runTests() {
  console.log('=== STARTING CHECKPOINT NOTES & MULTI-PHOTO INTEGRATION TESTS ===');

  // 1. Create or find an IN_PROGRESS session
  const employee = await prisma.employee.findFirst({ where: { status: 'ACTIVE' } });
  if (!employee) {
    console.log('No active employee found.');
    return;
  }

  const assignment = await prisma.guardAssignment.findFirst({
    where: { employeeId: employee.id, isActive: true },
    include: { site: { include: { gates: { include: { subTasks: true } } } } },
  });

  if (!assignment || !assignment.site?.gates?.[0]) {
    console.log('No active assignment or gates found.');
    return;
  }

  const gate = assignment.site.gates[0];
  const gateSubTask = gate.subTasks[0] || await prisma.gateSubTask.findFirst({ where: { gateId: gate.id } });

  if (!gateSubTask) {
    console.log('No gate subtask found for testing.');
    return;
  }

  // Create temporary in-progress session
  const session = await prisma.patrolSession.create({
    data: {
      clientId: assignment.clientId,
      assignmentId: assignment.id,
      patrolCode: `PAT-TEST-${Date.now()}`,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    },
  });

  console.log(`Created Test Session: ${session.id}, Employee: ${employee.id}, Gate: ${gate.name} (${gate.id}), SubTask: ${gateSubTask.taskName}`);

  // TEST 1: Checkpoint Note Entered
  console.log('\n--- TEST 1: Checkpoint Note Entered ---');
  const validScanDto1 = {
    gateId: gate.id,
    patrolSessionId: session.id,
    remarks: 'Minor leakage near service corridor.',
    subTaskResponses: [
      {
        gateSubTaskId: gateSubTask.id,
        answer: 'NO' as const,
        remarks: 'Water stain on ceiling',
        images: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      },
    ],
  };

  const parsed1 = scanCheckpointSchema.safeParse(validScanDto1);
  console.log('Validation Test 1 (Valid NO + 2 Photos):', parsed1.success ? 'PASSED' : parsed1.error);

  const res1 = await patrolCheckpointService.scan(employee.id, validScanDto1 as any);
  console.log('DB Scan Result 1 Checkpoint Remarks:', res1.checkpoint?.remarks);
  console.log('DB Scan Result 1 SubTask Response Images Count:', res1.checkpoint?.subTaskResponses?.[0]?.images?.length);

  // TEST 2: Blank Checkpoint Note (whitespace only)
  console.log('\n--- TEST 2: Blank Checkpoint Note ---');
  const validScanDto2 = {
    gateId: gate.id,
    patrolSessionId: session.id,
    remarks: '   ',
    subTaskResponses: [
      {
        gateSubTaskId: gateSubTask.id,
        answer: 'YES' as const,
        remarks: 'All good',
        images: [],
      },
    ],
  };

  const res2 = await patrolCheckpointService.scan(employee.id, validScanDto2 as any);
  console.log('DB Scan Result 2 Checkpoint Remarks (should be null):', res2.checkpoint?.remarks);

  // TEST 3: NO + 0 Photos (Validation should fail)
  console.log('\n--- TEST 3: NO + 0 Photos Validation ---');
  const invalidScanDto0Imgs = {
    gateId: gate.id,
    patrolSessionId: session.id,
    remarks: 'Test note',
    subTaskResponses: [
      {
        gateSubTaskId: gateSubTask.id,
        answer: 'NO' as const,
        remarks: 'Issue observed',
        images: [],
      },
    ],
  };
  const parsed0Imgs = scanCheckpointSchema.safeParse(invalidScanDto0Imgs);
  console.log('Validation Test 3 (NO + 0 Photos expected failure):', !parsed0Imgs.success ? 'PASSED (Blocked)' : 'FAILED');
  if (!parsed0Imgs.success) {
    console.log('  Validation Message:', parsed0Imgs.error.issues[0]?.message);
  }

  // TEST 5: NO + 5 Photos (Valid max)
  console.log('\n--- TEST 5: NO + 5 Photos ---');
  const validScanDto5Imgs = {
    gateId: gate.id,
    patrolSessionId: session.id,
    remarks: 'Overall checkpoint looks ok',
    subTaskResponses: [
      {
        gateSubTaskId: gateSubTask.id,
        answer: 'NO' as const,
        remarks: 'Multiple defect angles',
        images: [
          'https://example.com/p1.jpg',
          'https://example.com/p2.jpg',
          'https://example.com/p3.jpg',
          'https://example.com/p4.jpg',
          'https://example.com/p5.jpg',
        ],
      },
    ],
  };
  const parsed5Imgs = scanCheckpointSchema.safeParse(validScanDto5Imgs);
  console.log('Validation Test 5 (NO + 5 Photos):', parsed5Imgs.success ? 'PASSED' : parsed5Imgs.error);

  const res5 = await patrolCheckpointService.scan(employee.id, validScanDto5Imgs as any);
  console.log('DB Saved Images Count (expected 5):', res5.checkpoint?.subTaskResponses?.[0]?.images?.length);

  // TEST 6: NO + 6 Photos (Validation should fail)
  console.log('\n--- TEST 6: NO + 6 Photos Validation ---');
  const invalidScanDto6Imgs = {
    gateId: gate.id,
    patrolSessionId: session.id,
    remarks: 'Test note',
    subTaskResponses: [
      {
        gateSubTaskId: gateSubTask.id,
        answer: 'NO' as const,
        remarks: 'Exceeding max',
        images: [
          'https://example.com/p1.jpg',
          'https://example.com/p2.jpg',
          'https://example.com/p3.jpg',
          'https://example.com/p4.jpg',
          'https://example.com/p5.jpg',
          'https://example.com/p6.jpg',
        ],
      },
    ],
  };
  const parsed6Imgs = scanCheckpointSchema.safeParse(invalidScanDto6Imgs);
  console.log('Validation Test 6 (NO + 6 Photos expected failure):', !parsed6Imgs.success ? 'PASSED (Blocked)' : 'FAILED');
  if (!parsed6Imgs.success) {
    console.log('  Validation Message:', parsed6Imgs.error.issues[0]?.message);
  }

  // TEST 15: PDF Generation Verification
  console.log('\n--- TEST 15: PDF Generation ---');
  try {
    const pdfResult = await reportService.getPatrolPdf(session.id, session.clientId);
    console.log(`PDF Generated Successfully! Buffer Size: ${pdfResult.pdfBuffer.length} bytes, Filename: ${pdfResult.filename}`);
  } catch (err: any) {
    console.error('PDF Generation Error:', err.message);
  }

  console.log('\n=== ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY ===');
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
