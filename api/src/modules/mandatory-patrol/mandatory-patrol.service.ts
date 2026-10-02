import { prisma } from '../../database/prisma';
import { logger } from '../../common/logger/logger';
import { calculateMandatoryWindow } from './mandatory-patrol.util';
import { notificationService } from '../notification/notification.service';

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
    const dateOnly = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());

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
          status: 'UPCOMING',
        },
        update: {
          scheduledAt: window1.scheduledAt,
          windowStart: window1.windowStart,
          windowEnd: window1.windowEnd,
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
          status: 'UPCOMING',
        },
        update: {
          scheduledAt: window2.scheduledAt,
          windowStart: window2.windowStart,
          windowEnd: window2.windowEnd,
        },
      });

      instances.push(inst2);
    }

    return instances;
  }

  /**
   * Evaluate all active assignments and update mandatory patrol instance statuses.
   * Emits MANDATORY_PATROL_DUE and MANDATORY_PATROL_MISSED notifications.
   */
  async evaluateMandatoryPatrolStatuses() {
    const now = new Date();
    const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Sync instances for all active assignments today
    const activeAssignments = await prisma.guardAssignment.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    for (const assignment of activeAssignments) {
      try {
        await this.syncMandatoryPatrolInstancesForAssignment(assignment.id, todayDateOnly);
      } catch (err: any) {
        logger.error(`Failed to sync mandatory patrol instances for assignment ${assignment.id}: ${err.message}`);
      }
    }

    // 2. Fetch instances needing status evaluation
    const pendingInstances = await prisma.mandatoryPatrolInstance.findMany({
      where: {
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
    });

    for (const inst of pendingInstances) {
      const employeeName = `${inst.employee.firstName} ${inst.employee.lastName || ''}`.trim();
      const siteName = inst.assignment?.site?.name || 'Assigned Site';
      const shiftName = inst.assignment?.shift?.name || 'Shift';

      const formatTime = (d: Date) =>
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      // Check transition to DUE
      if (inst.status === 'UPCOMING' && now >= inst.windowStart && now <= inst.windowEnd) {
        await prisma.mandatoryPatrolInstance.update({
          where: { id: inst.id },
          data: { status: 'DUE' },
        });

        const reqTime = formatTime(inst.scheduledAt);
        const winStart = formatTime(inst.windowStart);
        const winEnd = formatTime(inst.windowEnd);

        await notificationService.createNotification({
          clientId: inst.clientId,
          type: 'MANDATORY_PATROL_DUE',
          title: '🔴 Mandatory Patrol Due',
          message: `${employeeName}'s Mandatory Patrol ${inst.sequence} at ${siteName} is now due. Required time: ${reqTime} (${winStart} – ${winEnd}).`,
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
          idempotencyKey: `MANDATORY_PATROL_DUE_${inst.id}`,
        });
      }

      // Check transition to MISSED
      if ((inst.status === 'UPCOMING' || inst.status === 'DUE') && now > inst.windowEnd) {
        await prisma.mandatoryPatrolInstance.update({
          where: { id: inst.id },
          data: { status: 'MISSED' },
        });

        const winEndStr = formatTime(inst.windowEnd);

        await notificationService.createNotification({
          clientId: inst.clientId,
          type: 'MANDATORY_PATROL_MISSED',
          title: '⚠️ Mandatory Patrol Missed',
          message: `${employeeName}'s Mandatory Patrol ${inst.sequence} at ${siteName} was missed (window ended at ${winEndStr}).`,
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
          idempotencyKey: `MANDATORY_PATROL_MISSED_${inst.id}`,
        });
      }
    }
  }

  /**
   * Called when a guard completes a patrol session.
   * Checks if completed patrol falls within an active mandatory patrol window and updates instance status to COMPLETED.
   */
  async handlePatrolCompleted(patrolSession: any) {
    if (!patrolSession || !patrolSession.assignmentId) return;

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
        const formattedTime = completionTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        await notificationService.createNotification({
          clientId: inst.clientId,
          type: 'MANDATORY_PATROL_COMPLETED',
          title: '✅ Mandatory Patrol Completed',
          message: `${employeeName} completed Mandatory Patrol ${inst.sequence} at ${siteName} (${formattedTime}).`,
          entityType: 'MandatoryPatrolInstance',
          entityId: inst.id,
          metadata: {
            employeeId: inst.employeeId,
            employeeName,
            siteName,
            sequence: inst.sequence,
            completedAt: completionTime,
            patrolSessionId: patrolSession.id,
          },
          idempotencyKey: `MANDATORY_PATROL_COMPLETED_${inst.id}`,
        });

        logger.info(`✅ Marked Mandatory Patrol ${inst.sequence} as COMPLETED for employee ${inst.employeeId}`);
        break; // Satisfy one mandatory patrol instance per completed patrol
      }
    }
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

    const todayDateOnly = new Date();
    todayDateOnly.setHours(0, 0, 0, 0);

    // Sync to ensure instances exist for today
    await this.syncMandatoryPatrolInstancesForAssignment(assignment.id, todayDateOnly);

    // Fetch instances with updated statuses
    const updatedInstances = await prisma.mandatoryPatrolInstance.findMany({
      where: {
        assignmentId: assignment.id,
        shiftDate: todayDateOnly,
      },
      orderBy: { sequence: 'asc' },
    });

    const now = new Date();

    const formattedPatrols = updatedInstances.map((inst) => {
      let currentStatus = inst.status;

      // Realtime check for UI accuracy
      if (currentStatus === 'UPCOMING' && now >= inst.windowStart && now <= inst.windowEnd) {
        currentStatus = 'DUE';
      } else if ((currentStatus === 'UPCOMING' || currentStatus === 'DUE') && now > inst.windowEnd) {
        currentStatus = 'MISSED';
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

  /**
   * Get mandatory patrol compliance for admin
   */
  async getAssignmentMandatoryPatrols(assignmentId: string) {
    const todayDateOnly = new Date();
    todayDateOnly.setHours(0, 0, 0, 0);

    await this.syncMandatoryPatrolInstancesForAssignment(assignmentId, todayDateOnly);

    return prisma.mandatoryPatrolInstance.findMany({
      where: { assignmentId },
      orderBy: [{ shiftDate: 'desc' }, { sequence: 'asc' }],
    });
  }
}

export const mandatoryPatrolService = new MandatoryPatrolService();
