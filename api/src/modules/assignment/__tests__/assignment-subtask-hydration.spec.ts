import { hydrateGateSubTasks } from '../assignment.service';

describe('Assignment Checkpoint SubTask Hydration (Offline Support)', () => {
  it('hydrates CategorySubTasks onto gate.subTasks when gate has categoryId and category subtasks', () => {
    const rawGate = {
      id: 'cmucoq1rl066phpt08lk5qqe6',
      name: 'Sewage room - Basement 6',
      gateCode: 'GATE-000001',
      categoryId: 'cmuv9eoyt000vhp87txsnq5hv',
      subTasks: [], // Direct GateSubTask is empty in database
      category: {
        id: 'cmuv9eoyt000vhp87txsnq5hv',
        name: 'Garbage',
        subTasks: [
          {
            id: 'task-1',
            categoryId: 'cmuv9eoyt000vhp87txsnq5hv',
            role: 'SECURITY',
            taskName: 'All Area Cleaned',
            description: 'Ensure area is clean',
            displayOrder: 1,
            isRequired: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'task-2',
            categoryId: 'cmuv9eoyt000vhp87txsnq5hv',
            role: 'SECURITY',
            taskName: 'Doors are operational',
            description: 'Check doors',
            displayOrder: 2,
            isRequired: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    };

    const hydrated = hydrateGateSubTasks(rawGate);

    expect(hydrated.subTasks).toHaveLength(2);
    expect(hydrated.hasSubTasksConfigured).toBe(true);
    expect(hydrated.subTasks[0]).toMatchObject({
      id: 'task-1',
      gateId: 'cmucoq1rl066phpt08lk5qqe6',
      role: 'SECURITY',
      taskName: 'All Area Cleaned',
      isCategorySubTask: true,
      categoryId: 'cmuv9eoyt000vhp87txsnq5hv',
      isRequired: true,
    });
    expect(hydrated.subTasks[1]).toMatchObject({
      id: 'task-2',
      gateId: 'cmucoq1rl066phpt08lk5qqe6',
      role: 'SECURITY',
      taskName: 'Doors are operational',
      isCategorySubTask: true,
      categoryId: 'cmuv9eoyt000vhp87txsnq5hv',
      isRequired: true,
    });
  });

  it('preserves direct GateSubTasks when gate has no categoryId', () => {
    const rawGate = {
      id: 'gate-direct-1',
      name: 'Main Lobby',
      gateCode: 'GATE-000002',
      categoryId: null,
      subTasks: [
        {
          id: 'direct-task-1',
          gateId: 'gate-direct-1',
          role: 'SECURITY',
          taskName: 'Check Visitor Log',
          displayOrder: 1,
          isRequired: true,
          isActive: true,
        },
      ],
    };

    const hydrated = hydrateGateSubTasks(rawGate);

    expect(hydrated.subTasks).toHaveLength(1);
    expect(hydrated.hasSubTasksConfigured).toBe(true);
    expect(hydrated.subTasks[0].taskName).toBe('Check Visitor Log');
  });

  it('handles gates with no subtasks configured gracefully', () => {
    const rawGate = {
      id: 'gate-no-tasks',
      name: 'Corridor 4',
      gateCode: 'GATE-000003',
      categoryId: null,
      subTasks: [],
    };

    const hydrated = hydrateGateSubTasks(rawGate);

    expect(hydrated.subTasks).toEqual([]);
    expect(hydrated.hasSubTasksConfigured).toBe(false);
  });
});

