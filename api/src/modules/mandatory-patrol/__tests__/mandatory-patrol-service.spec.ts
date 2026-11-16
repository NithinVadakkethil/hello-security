import { prisma } from '../../../database/prisma';
import { mandatoryPatrolService } from '../mandatory-patrol.service';

jest.mock('../../../database/prisma', () => ({
  prisma: {
    guardAssignment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    mandatoryPatrolInstance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../modules/notification/notification.service', () => ({
  notificationService: {
    createNotification: jest.fn(),
  },
}));

describe('MandatoryPatrolService — End-to-End Schedule & Sync Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAssignment = {
    id: 'asgn-rt11-day',
    clientId: 'client-kaizen-ct',
    employeeId: 'emp-jithin',
    isActive: true,
    site: {
      id: 'site-rt11',
      name: 'RT 11 - Cleopatra Tower',
      timeZone: 'Asia/Dubai',
    },
    shift: {
      id: 'shift-day-rt11',
      name: 'Security - Day',
      startTime: '08:00',
      endTime: '20:00',
      // Bare hours entered by client admin
      mandatoryPatrol1Time: '11',
      mandatoryPatrol1WindowBefore: 15,
      mandatoryPatrol1WindowAfter: 60,
      mandatoryPatrol2Time: '18',
      mandatoryPatrol2WindowBefore: 15,
      mandatoryPatrol2WindowAfter: 60,
    },
    patrolRoute: {
      id: 'route-rt11-perimeter',
      name: 'Cleopatra Full Perimeter',
    },
  };

  it('syncMandatoryPatrolInstancesForAssignment creates correct instances in Asia/Dubai for bare-hour shift', async () => {
    (prisma.guardAssignment.findUnique as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.mandatoryPatrolInstance.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.mandatoryPatrolInstance.upsert as jest.Mock).mockImplementation((args) => Promise.resolve(args.create));

    const shiftDate = new Date('2026-11-16T00:00:00.000Z');
    const instances = await mandatoryPatrolService.syncMandatoryPatrolInstancesForAssignment(
      'asgn-rt11-day',
      shiftDate,
    );

    expect(instances).toHaveLength(2);

    // Patrol 1: 11:00 AM Dubai (07:00 UTC), Window: 10:45 AM - 12:00 PM (06:45 - 08:00 UTC)
    const p1 = instances[0];
    expect(p1.sequence).toBe(1);
    expect(p1.scheduledAt.toISOString()).toBe('2026-11-16T07:00:00.000Z');
    expect(p1.windowStart.toISOString()).toBe('2026-11-16T06:45:00.000Z');
    expect(p1.windowEnd.toISOString()).toBe('2026-11-16T08:00:00.000Z');

    // Patrol 2: 6:00 PM Dubai (14:00 UTC), Window: 5:45 PM - 7:00 PM (13:45 - 15:00 UTC)
    const p2 = instances[1];
    expect(p2.sequence).toBe(2);
    expect(p2.scheduledAt.toISOString()).toBe('2026-11-16T14:00:00.000Z');
    expect(p2.windowStart.toISOString()).toBe('2026-11-16T13:45:00.000Z');
    expect(p2.windowEnd.toISOString()).toBe('2026-11-16T15:00:00.000Z');
  });

  it('getEmployeeMandatorySchedule returns accurate schedule and statuses at 4:05 PM Dubai time', async () => {
    (prisma.guardAssignment.findFirst as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.guardAssignment.findUnique as jest.Mock).mockResolvedValue(mockAssignment);
    (prisma.mandatoryPatrolInstance.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.mandatoryPatrolInstance.upsert as jest.Mock).mockImplementation((args) => Promise.resolve(args.create));

    // Instances in database
    const dbInstances = [
      {
        id: 'inst-1',
        sequence: 1,
        scheduledAt: new Date('2026-11-16T07:00:00.000Z'), // 11:00 AM Dubai
        windowStart: new Date('2026-11-16T06:45:00.000Z'), // 10:45 AM Dubai
        windowEnd: new Date('2026-11-16T08:00:00.000Z'),   // 12:00 PM Dubai
        status: 'UPCOMING',
        completedAt: null,
        patrolSessionId: null,
      },
      {
        id: 'inst-2',
        sequence: 2,
        scheduledAt: new Date('2026-11-16T14:00:00.000Z'), // 6:00 PM Dubai
        windowStart: new Date('2026-11-16T13:45:00.000Z'), // 5:45 PM Dubai
        windowEnd: new Date('2026-11-16T15:00:00.000Z'),   // 7:00 PM Dubai
        status: 'UPCOMING',
        completedAt: null,
        patrolSessionId: null,
      },
    ];
    (prisma.mandatoryPatrolInstance.findMany as jest.Mock).mockResolvedValue(dbInstances);

    // Mock Date.now / system clock to 4:05 PM Dubai time (12:05 UTC)
    const fixedNow = new Date('2026-11-16T12:05:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);

    const schedule = await mandatoryPatrolService.getEmployeeMandatorySchedule('emp-jithin');

    expect(schedule.hasAssignment).toBe(true);
    expect(schedule.mandatoryPatrols).toHaveLength(2);

    const patrol1 = schedule.mandatoryPatrols[0];
    const patrol2 = schedule.mandatoryPatrols[1];

    // Patrol 1 window (ended at 08:00 UTC) has passed -> marked MISSED
    expect(patrol1.sequence).toBe(1);
    expect(patrol1.status).toBe('MISSED');
    expect(patrol1.scheduledAt.toISOString()).toBe('2026-11-16T07:00:00.000Z');

    // Patrol 2 window (starts at 13:45 UTC) has not yet started -> marked UPCOMING
    expect(patrol2.sequence).toBe(2);
    expect(patrol2.status).toBe('UPCOMING');
    expect(patrol2.scheduledAt.toISOString()).toBe('2026-11-16T14:00:00.000Z');

    jest.useRealTimers();
  });

  it('updates previously corrupted midnight records upon sync without losing data', async () => {
    (prisma.guardAssignment.findUnique as jest.Mock).mockResolvedValue(mockAssignment);

    // Existing corrupted instance in DB from old bug (scheduledAt was 00:00 Dubai)
    const oldCorruptedRecord = {
      id: 'inst-corrupted-1',
      sequence: 1,
      scheduledAt: new Date('2026-11-15T20:00:00.000Z'), // 12:00 AM Dubai
      windowStart: new Date('2026-11-15T19:45:00.000Z'), // 11:45 PM
      windowEnd: new Date('2026-11-15T21:00:00.000Z'),   // 1:00 AM
      status: 'MISSED',
    };
    (prisma.mandatoryPatrolInstance.findUnique as jest.Mock).mockResolvedValue(oldCorruptedRecord);

    const upsertCalls: any[] = [];
    (prisma.mandatoryPatrolInstance.upsert as jest.Mock).mockImplementation((args) => {
      upsertCalls.push(args);
      return Promise.resolve({ ...oldCorruptedRecord, ...args.update });
    });

    const shiftDate = new Date('2026-11-16T00:00:00.000Z');
    await mandatoryPatrolService.syncMandatoryPatrolInstancesForAssignment('asgn-rt11-day', shiftDate);

    // Verify upsert update was called for sequence 1 with the corrected 11:00 AM Dubai time
    expect(upsertCalls[0].update.scheduledAt.toISOString()).toBe('2026-11-16T07:00:00.000Z');
    expect(upsertCalls[0].update.windowStart.toISOString()).toBe('2026-11-16T06:45:00.000Z');
    expect(upsertCalls[0].update.windowEnd.toISOString()).toBe('2026-11-16T08:00:00.000Z');

    // Verify upsert update was called for sequence 2 with the corrected 6:00 PM Dubai time
    expect(upsertCalls[1].update.scheduledAt.toISOString()).toBe('2026-11-16T14:00:00.000Z');
    expect(upsertCalls[1].update.windowStart.toISOString()).toBe('2026-11-16T13:45:00.000Z');
    expect(upsertCalls[1].update.windowEnd.toISOString()).toBe('2026-11-16T15:00:00.000Z');
  });
});
