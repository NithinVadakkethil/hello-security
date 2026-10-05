import { prisma } from '../../database/prisma';
import { logger } from '../../common/logger/logger';
import { calculateMandatoryWindow, getEffectiveShiftDate } from './mandatory-patrol.util';
import { notificationService } from '../notification/notification.service';
import { formatPatrolTime, DEFAULT_TIMEZONE } from '../../common/utils/date-formatter.util';

export class MandatoryPatrolService {
  /**
   * Ensure mandatory patrol instances exist for a guard assignment on a given shift date.
   */
  async syncMandatoryPatrolInstancesForAssignment(assignmentId: string, shiftDate: Date = new Date()) {
    const assignment = await prisma.guardAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        shift: true,
        employee: true,
        site: true,
      },
    });

    if (!assignment || !assignment.isActive || !assignment.shift) {
      return [];
    }

    const { shift, employeeId, clientId } = assignment;
    const dateOnly = new Date(Date.UTC(shiftDate.getUTCFullYear(), shiftDate.getUTCMonth(), shiftDate.getUTCDate()));

    const instances: any[] = [];

    // Mandatory Patrol 1
    if (shift.mandatoryPatrol1Time) {
      const window1 = calculateMandatoryWindow(
        shift.startTime,
        shift.endTime,
        dateOnly,
        shift.mandatoryPatrol1Time,
        shift.mandatoryPatrol1WindowBefore || 15,
        shift.mandatoryPatrol1WindowAfter || 15,
      );

      const existing1 = await prisma.mandatoryPatrolInstance.findUnique({
        where: {
          assignmentId_shiftDate_sequence: {
            assignmentId,
            shiftDate: dateOnly,
            sequence: 1,
          },
        },
      });

      const now = new Date();
      const nextStatus1 =
        existing1?.status === 'COMPLETED'
          ? 'COMPLETED'
          : now < window1.windowStart
          ? 'UPCOMING'
          : now <= window1.windowEnd
          ? 'DUE'
          : 'MISSED';

      const inst1 = await prisma.mandatoryPatrolInstance.upsert({
        where: {
          assignmentId_shiftDate_sequence: {
            assignmentId,
            shiftDate: dateOnly,
            sequence: 1,
          },
        },
        create: {
          clientId,
          assignmentId,
          employeeId,
          shiftId: shift.id,
          shiftDate: dateOnly,
          sequence: 1,
          scheduledAt: window1.scheduledAt,
          windowStart: window1.windowStart,
          windowEnd: window1.windowEnd,
          status: nextStatus1,
        },
        update: {
          scheduledAt: window1.scheduledAt,
          windowStart: window1.windowStart,
          windowEnd: window1.windowEnd,
          status: nextStatus1,
        },
      });

      instances.push(inst1);
    }

    // Mandatory Patrol 2
    if (shift.mandatoryPatrol2Time) {
      const window2 = calculateMandatoryWindow(
        shift.startTime,
        shift.endTime,
        dateOnly,
        shift.mandatoryPatrol2Time,
        shift.mandatoryPatrol2WindowBefore || 15,
        shift.mandatoryPatrol2WindowAfter || 15,
      );

      const existing2 = await prisma.mandatoryPatrolInstance.findUnique({
        where: {
          assignmentId_shiftDate_sequence: {
            assignmentId,
            shiftDate: dateOnly,
            sequence: 2,
          },
        },
      });

      const now = new Date();
      const nextStatus2 =
        existing2?.status === 'COMPLETED'
          ? 'COMPLETED'
          : now < window2.windowStart
          ? 'UPCOMING'
          : now <= window2.windowEnd
          ? 'DUE'
          : 'MISSED';

      const inst2 = await prisma.mandatoryPatrolInstance.upsert({
        where: {
          assignmentId_shiftDate_sequence: {
            assignmentId,
            shiftDate: dateOnly,
            sequence: 2,
          },
        },
        create: {
          clientId,
          assignmentId,
          employeeId,
          shiftId: shift.id,
          shiftDate: dateOnly,
          sequence: 2,
          scheduledAt: window2.scheduledAt,
          windowStart: window2.windowStart,
          windowEnd: window2.windowEnd,
          status: nextStatus2,
        },
        update: {
          scheduledAt: window2.scheduledAt,
          windowStart: window2.windowStart,
          windowEnd: window2.windowEnd,
          status: nextStatus2,
        },
      });

      instances.push(inst2);
    }

    return instances;
  }

  /**
   * Evaluate all active assignments and update mandatory patrol instance statuses.
   * Emits MANDATORY_PATROL_MISSED notification to Client Admin when window closes.
   */
  async evaluateMandatoryPatrolStatuses() {
    const now = new Date();

    // 1. Sync instances for all active assignments today (accounting for overnight shift date)
    const activeAssignments = await prisma.guardAssignment.findMany({
      where: { isActive: true },
      include: { shift: true },
    });

    for (const assignment of activeAssignments) {
      try {
        const effectiveShiftDate = getEffectiveShiftDate(
          assignment.shift?.startTime,
          assignment.shift?.endTime,
          now,
        );
        await this.syncMandatoryPatrolInstancesForAssignment(assignment.id, effectiveShiftDate);
      } catch (err: any) {
        logger.error(`Failed to sync mandatory patrol instances for assignment ${assignment.id}: ${err.message}`);
      }
    }

    // 2. Fetch all non-completed instances needing status evaluation
    const pendingInstances = await prisma.mandatoryPatrolInstance.findMany({
      where: {
        status: { not: 'COMPLETED' },
      },
      include: {
        employee: true,
        assignment: {
          include: {
            site: true,
            shift: true,
          },
        },
      },
    });

    for (const inst of pendingInstances) {
      const employeeName = `${inst.employee.firstName} ${inst.employee.lastName || ''}`.trim();
      const siteName = inst.assignment?.site?.name || 'Assigned Site';
      const shiftName = inst.assignment?.shift?.name || 'Shift';

      const formatTime = (d: Date) => formatPatrolTime(d, DEFAULT_TIMEZONE, false);

      // Check transition to UPCOMING (if shift was updated or scheduled in the future)
      if (now < inst.windowStart && inst.status !== 'UPCOMING') {
        await prisma.mandatoryPatrolInstance.update({
          where: { id: inst.id },
          data: { status: 'UPCOMING' },
        });
      }

      // Check transition to DUE (informational status only, do not notify Client Admin)
      if (now >= inst.windowStart && now <= inst.windowEnd && inst.status !== 'DUE') {
        await prisma.mandatoryPatrolInstance.update({
          where: { id: inst.id },
          data: { status: 'DUE' },
        });
      }

      // Check transition to MISSED (window expired without qualifying patrol)
      if (now > inst.windowEnd && inst.status !== 'MISSED') {
        await prisma.mandatoryPatrolInstance.update({
          where: { id: inst.id },
          data: { status: 'MISSED' },
        });

        const reqTimeStr = formatTime(inst.scheduledAt);
        const winEndStr = formatTime(inst.windowEnd);

        await notificationService.createNotification({
          clientId: inst.clientId,
          type: 'MANDATORY_PATROL_MISSED',
          title: 'Mandatory Patrol Missed',
          message: `${employeeName} missed Mandatory Patrol ${inst.sequence} at ${siteName}.\nRequired: ${reqTimeStr}\nWindow ended: ${winEndStr}`,
          entityType: 'MandatoryPatrolInstance',
          entityId: inst.id,
          metadata: {
            employeeId: inst.employeeId,
            employeeName,
            siteName,
            shiftName,
            sequence: inst.sequence,
            scheduledAt: inst.scheduledAt,
            windowStart: inst.windowStart,
            windowEnd: inst.windowEnd,
          },
          idempotencyKey: `MANDATORY_PATROL_MISSED_${inst.id}_${inst.employeeId}`,
        });
      }
    }
  }

  /**
   * Called when a guard completes a patrol session.
   * Checks if completed patrol falls within an active mandatory patrol window and updates instance status to COMPLETED.
   * Returns true if a mandatory patrol instance was satisfied and completed, false otherwise.
   */
  async handlePatrolCompleted(patrolSession: any): Promise<boolean> {
    if (!patrolSession || !patrolSession.assignmentId) return false;

    const completionTime = patrolSession.endedAt || new Date();

    // Find any UPCOMING or DUE mandatory patrol instance for this assignment
    // where completion time falls within [windowStart - 10 mins early, windowEnd]
    const candidates = await prisma.mandatoryPatrolInstance.findMany({
      where: {
        assignmentId: patrolSession.assignmentId,
        status: { in: ['UPCOMING', 'DUE'] },
      },
      include: {
        employee: true,
        assignment: {
          include: {
            site: true,
            shift: true,
          },
        },
      },
      orderBy: { sequence: 'asc' },
    });

    for (const inst of candidates) {
      const earlyBufferMs = 10 * 60 * 1000;
      const validStart = new Date(inst.windowStart.getTime() - earlyBufferMs);

      if (completionTime >= validStart && completionTime <= inst.windowEnd) {
        // Mark as COMPLETED
        await prisma.mandatoryPatrolInstance.update({
          where: { id: inst.id },
          data: {
            status: 'COMPLETED',
            completedAt: completionTime,
            patrolSessionId: patrolSession.id,
          },
        });

        const employeeName = `${inst.employee.firstName} ${inst.employee.lastName || ''}`.trim();
        const siteName = inst.assignment?.site?.name || 'Assigned Site';
        const shiftName = inst.assignment?.shift?.name || 'Shift';

        // Emit MANDATORY_PATROL_COMPLETED notification
        await notificationService.createNotification({
          clientId: inst.clientId,
          type: 'MANDATORY_PATROL_COMPLETED',
          title: 'Mandatory patrol completed',
          message: `${employeeName} completed Mandatory Patrol ${inst.sequence} at ${siteName}.`,
          entityType: 'MandatoryPatrolInstance',
          entityId: inst.id,
          metadata: {
            employeeId: inst.employeeId,
            employeeName,
            employeeRole: inst.employee.role,
            clientId: inst.clientId,
            siteId: inst.assignment?.siteId,
            siteName,
            assignmentId: inst.assignmentId,
            shiftId: inst.assignment?.shiftId,
            shiftName,
            mandatoryPatrolNumber: inst.sequence,
            requiredTime: inst.scheduledAt,
            windowStart: inst.windowStart,
            windowEnd: inst.windowEnd,
            completedAt: completionTime,
            patrolSessionId: patrolSession.id,
          },
          idempotencyKey: `MANDATORY_PATROL_COMPLETED_${inst.id}_${patrolSession.id}`,
        });

        logger.info(`✅ Marked Mandatory Patrol ${inst.sequence} as COMPLETED for employee ${inst.employeeId} and sent notification`);
        return true; // Satisfy one mandatory patrol instance per completed patrol
      }
    }

    return false;
  }

  /**
   * Get mandatory patrol schedule & compliance for mobile employee home/patrol screen.
   */
  async getEmployeeMandatorySchedule(employeeId: string) {
    const assignment = await prisma.guardAssignment.findFirst({
      where: {
        employeeId,
        isActive: true,
      },
      include: {
        shift: true,
        site: true,
        patrolRoute: true,
      },
    });

    if (!assignment) {
      return {
        hasAssignment: false,
        assignment: null,
        mandatoryPatrols: [],
      };
    }

    const now = new Date();
    const effectiveShiftDate = getEffectiveShiftDate(
      assignment.shift?.startTime,
      assignment.shift?.endTime,
      now,
    );

    // Sync to ensure instances exist for effective shift date
    await this.syncMandatoryPatrolInstancesForAssignment(assignment.id, effectiveShiftDate);

    // Fetch instances with updated statuses
    const updatedInstances = await prisma.mandatoryPatrolInstance.findMany({
      where: {
        assignmentId: assignment.id,
        shiftDate: effectiveShiftDate,
      },
      orderBy: { sequence: 'asc' },
    });

    const formattedPatrols = updatedInstances.map((inst) => {
      let currentStatus = inst.status;

      // Realtime check for UI accuracy: accurately reflect current wall clock against window
      if (currentStatus !== 'COMPLETED') {
        if (now < inst.windowStart) {
          currentStatus = 'UPCOMING';
        } else if (now <= inst.windowEnd) {
          currentStatus = 'DUE';
        } else {
          currentStatus = 'MISSED';
        }
      }

      return {
        id: inst.id,
        sequence: inst.sequence,
        scheduledAt: inst.scheduledAt,
        windowStart: inst.windowStart,
        windowEnd: inst.windowEnd,
        status: currentStatus,
        completedAt: inst.completedAt,
        patrolSessionId: inst.patrolSessionId,
      };
    });

    return {
      hasAssignment: true,
      assignment: {
        id: assignment.id,
        siteName: assignment.site?.name,
        shiftName: assignment.shift?.name,
        shiftStartTime: assignment.shift?.startTime,
        shiftEndTime: assignment.shift?.endTime,
        routeName: assignment.patrolRoute?.name,
      },
      mandatoryPatrols: formattedPatrols,
    };
  }

  async getAssignmentMandatoryPatrols(assignmentId: string) {
    const assignment = await prisma.guardAssignment.findUnique({
      where: { id: assignmentId },
      include: { shift: true },
    });

    if (assignment) {
      const effectiveShiftDate = getEffectiveShiftDate(
        assignment.shift?.startTime,
        assignment.shift?.endTime,
        new Date(),
      );
      await this.syncMandatoryPatrolInstancesForAssignment(assignmentId, effectiveShiftDate);
    }

    return prisma.mandatoryPatrolInstance.findMany({
      where: { assignmentId },
      orderBy: [{ shiftDate: 'desc' }, { sequence: 'asc' }],
    });
  }
}

export const mandatoryPatrolService = new MandatoryPatrolService();
