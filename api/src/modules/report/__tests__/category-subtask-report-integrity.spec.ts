import { buildCheckpointTimeline } from '../../../common/utils/checkpoint-timeline.util';
import { hydrateGateSubTasks } from '../../assignment/assignment.service';

describe('Category Subtask Report Integrity & Verification Checklist (PATROL-SESSION-002572 Scenario)', () => {
  const mockCategorySubTasks = [
    {
      id: 'cat-st-1',
      categoryId: 'cat-1',
      taskName: 'Check Fire Extinguisher Pressure',
      description: 'Ensure gauge is in green zone',
      role: 'SECURITY',
      displayOrder: 1,
      isRequired: true,
      isActive: true,
    },
    {
      id: 'cat-st-2',
      categoryId: 'cat-1',
      taskName: 'Check Emergency Exit Door',
      description: 'Ensure door is unlocked and unobstructed',
      role: 'SECURITY',
      displayOrder: 2,
      isRequired: true,
      isActive: true,
    },
    {
      id: 'cat-st-3',
      categoryId: 'cat-1',
      taskName: 'Check Spillages or Debris',
      description: 'Report cleanliness issues',
      role: 'CLEANER',
      displayOrder: 3,
      isRequired: false,
      isActive: true,
    },
  ];

  const rawGate = {
    id: 'gate-corridor-19',
    gateCode: 'GATE-000197',
    name: 'Corridor-19th Floor',
    categoryId: 'cat-1',
    category: {
      id: 'cat-1',
      name: 'Corridor',
      subTasks: mockCategorySubTasks,
    },
    subTasks: [], // Direct subtasks empty; configured at category level
  };

  it('1. Correctly hydrates CategorySubTasks onto gate.subTasks with isCategorySubTask flag', () => {
    const hydrated = hydrateGateSubTasks(rawGate);
    expect(hydrated.subTasks).toHaveLength(3);
    expect(hydrated.subTasks[0].taskName).toBe('Check Fire Extinguisher Pressure');
    expect(hydrated.subTasks[0].isCategorySubTask).toBe(true);
    expect(hydrated.hasSubTasksConfigured).toBe(true);
  });

  it('2. Correlates category subtask responses with null gateSubTaskId using taskNameSnapshot', () => {
    const hydratedGate = hydrateGateSubTasks(rawGate);

    // Filter subtasks for SECURITY officer role
    const securityGate = {
      ...hydratedGate,
      subTasks: hydratedGate.subTasks.filter((st: any) => st.role === 'SECURITY'),
    };

    const mockScan = {
      id: 'cp-scan-1',
      gateId: 'gate-corridor-19',
      scannedAt: '2026-11-04T07:07:13.000Z',
      completedAt: '2026-11-04T07:07:20.000Z',
      remarks: 'Area clear and verified',
      subTaskResponses: [
        {
          id: 'res-1',
          patrolCheckpointId: 'cp-scan-1',
          gateSubTaskId: null, // Category subtasks have null gateSubTaskId to avoid FK violation
          taskNameSnapshot: 'Check Fire Extinguisher Pressure',
          roleSnapshot: 'SECURITY',
          isRequiredSnapshot: true,
          answer: 'YES',
          remarks: 'Pressure normal',
          images: ['https://storage.helloorbit.com/proof1.jpg'],
          answeredAt: '2026-11-04T07:07:16.000Z',
        },
        {
          id: 'res-2',
          patrolCheckpointId: 'cp-scan-1',
          gateSubTaskId: null,
          taskNameSnapshot: 'Check Emergency Exit Door',
          roleSnapshot: 'SECURITY',
          isRequiredSnapshot: true,
          answer: 'YES',
          remarks: null,
          images: [],
          answeredAt: '2026-11-04T07:07:18.000Z',
        },
      ],
    };

    const mockReport = {
      id: 'session-2572',
      patrolCode: 'PATROL-SESSION-002572',
      assignment: {
        employee: {
          firstName: 'Amrit',
          lastName: 'Kunwar',
          employeeNumber: 'EMP-000037',
          role: 'SECURITY',
        },
        routeGates: [{ sequence: 1, gate: securityGate }],
      },
      checkpoints: [{ ...mockScan, gate: securityGate }],
    };

    const timeline = buildCheckpointTimeline(mockReport, 'Amrit Kunwar', 'SECURITY');
    expect(timeline).toHaveLength(1);

    const cpEntry = timeline[0];
    expect(cpEntry.scanned).toBe(true);
    expect(cpEntry.gate.name).toBe('Corridor-19th Floor');
    expect(cpEntry.tasks).toHaveLength(2);

    // Verify task 1 matched answer YES and evidence
    const task1 = cpEntry.tasks.find((t) => t.title === 'Check Fire Extinguisher Pressure');
    expect(task1).toBeDefined();
    expect(task1?.answer).toBe('YES');
    expect(task1?.remarks).toBe('Pressure normal');
    expect(task1?.images).toHaveLength(1);
    expect(task1?.submittedBy).toBe('Amrit Kunwar');

    // Verify task 2 matched answer YES
    const task2 = cpEntry.tasks.find((t) => t.title === 'Check Emergency Exit Door');
    expect(task2).toBeDefined();
    expect(task2?.answer).toBe('YES');

    // Verify subTaskResponses is preserved on timeline item for frontend modal
    expect(cpEntry.subTaskResponses).toHaveLength(2);
  });

  it('3. Fallback preserves historical submitted responses when gate.subTasks is unhydrated', () => {
    // Unhydrated gate where gate.subTasks is empty
    const unhydratedGate = {
      id: 'gate-corridor-19',
      gateCode: 'GATE-000197',
      name: 'Corridor-19th Floor',
      subTasks: [],
    };

    const mockScan = {
      id: 'cp-scan-1',
      gateId: 'gate-corridor-19',
      scannedAt: '2026-11-04T07:07:13.000Z',
      completedAt: '2026-11-04T07:07:20.000Z',
      subTaskResponses: [
        {
          id: 'res-1',
          patrolCheckpointId: 'cp-scan-1',
          gateSubTaskId: null,
          taskNameSnapshot: 'Check Fire Extinguisher Pressure',
          roleSnapshot: 'SECURITY',
          isRequiredSnapshot: true,
          answer: 'YES',
          remarks: 'Pressure normal',
          images: [],
          answeredAt: '2026-11-04T07:07:16.000Z',
        },
      ],
    };

    const mockReport = {
      id: 'session-2572',
      patrolCode: 'PATROL-SESSION-002572',
      assignment: {
        employee: {
          firstName: 'Amrit',
          lastName: 'Kunwar',
          employeeNumber: 'EMP-000037',
          role: 'SECURITY',
        },
      },
      checkpoints: [{ ...mockScan, gate: unhydratedGate }],
    };

    const timeline = buildCheckpointTimeline(mockReport, 'Amrit Kunwar', 'SECURITY');
    expect(timeline).toHaveLength(1);
    expect(timeline[0].tasks).toHaveLength(1);
    expect(timeline[0].tasks[0].title).toBe('Check Fire Extinguisher Pressure');
    expect(timeline[0].tasks[0].answer).toBe('YES');
  });
});

