import { NotificationStatus } from '@prisma/client';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '../database/prisma';
import { clientNotificationRepository } from '../modules/client-notification/client-notification.repository';
import { patrolSessionRepository } from '../modules/patrol-session/patrol-session.repository';
import { emailProvider } from '../common/email/SmtpEmailProvider';
import {
  buildConsolidatedRouteCycleEmailHtml,
  RouteSummaryItem,
} from '../common/email/templates/patrol-completed.template';
import { logger } from '../common/logger/logger';
import { redisConfig } from '../config/redis.config';
import { COMPLETED_PATROL_QUEUE_NAME } from '../common/queue/notification-queue.service';
import { generateReportDownloadToken } from '../common/auth/report-token';
import { formatPatrolTime } from '../common/utils/date-formatter.util';

export async function processCompletedPatrolNotification(
  patrolSessionId: string,
  clientId: string,
) {
  // 1. Load client notification settings & recipients
  const settings = await clientNotificationRepository.getSettings(clientId);

  if (!settings.patrolCompletedEmailEnabled) {
    logger.info(`ℹ️ Patrol completed notifications disabled for client ${clientId}. Skipping.`);
    return;
  }

  // 2. Load completed patrol details
  const patrol = await patrolSessionRepository.findFullById(patrolSessionId);

  if (!patrol) {
    logger.error(`❌ Patrol session ${patrolSessionId} not found. Cannot process notification.`);
    return;
  }

  // Ensure patrol session belongs to tenant client
  if (patrol.clientId !== clientId) {
    logger.error(`CRITICAL TENANT ERROR: Patrol session clientId (${patrol.clientId}) does not match job clientId (${clientId}).`);
    return;
  }

  const employeeId = patrol.assignment.employeeId;
  const siteId = patrol.assignment.siteId;
  const shiftId = patrol.assignment.shiftId;
  const officerName = `${patrol.assignment.employee.firstName} ${patrol.assignment.employee.lastName}`;
  const employeeNumber = patrol.assignment.employee.employeeNumber;
  const officerRole = (patrol.assignment.employee.role || 'SECURITY').toUpperCase();
  const siteName = patrol.assignment.site.name;
  const shiftName = `${patrol.assignment.shift.name} (${patrol.assignment.shift.startTime} - ${patrol.assignment.shift.endTime})`;

  // Resolve recipients: GLOBAL recipients + ROLE-SPECIFIC recipients for officerRole
  const globalRecipients = settings.recipients
    .filter((r: any) => r.isActive && (r.role === 'GLOBAL' || !r.role))
    .map((r: any) => r.email);

  const roleRecipients = settings.recipients
    .filter((r: any) => r.isActive && r.role && r.role.toUpperCase() === officerRole)
    .map((r: any) => r.email);

  const activeRecipients = Array.from(
    new Set([...globalRecipients, ...roleRecipients].map((e: string) => e.trim().toLowerCase())),
  ).filter(Boolean);

  if (activeRecipients.length === 0) {
    logger.info(
      `ℹ️ No active notification recipients configured for client ${clientId} and role ${officerRole}. Skipping.`,
    );
    return;
  }

  // 3. Resolve active assigned routes for this employee at this site & shift
  const activeAssignments = await prisma.guardAssignment.findMany({
    where: {
      employeeId,
      siteId,
      shiftId,
      isActive: true,
    },
    include: {
      patrolRoute: {
        include: {
          routeGates: { include: { gate: true } },
        },
      },
      assignmentGates: { include: { gate: true } },
    },
  });

  const assignedRouteIds = new Set<string>();
  activeAssignments.forEach((asg) => {
    if (asg.assignmentType === 'ROUTE' && asg.patrolRouteId) {
      assignedRouteIds.add(asg.patrolRouteId);
    } else if (asg.assignmentType === 'DIRECT_CHECKPOINTS') {
      assignedRouteIds.add(asg.id);
    }
  });

  const totalAssignedRoutesCount = Math.max(assignedRouteIds.size, 1);

  // 4. Resolve completed patrol sessions for this employee & site & shift in current cycle
  const startedAt = patrol.startedAt;
  const cycleDate = startedAt.toISOString().split('T')[0];
  const cycleStart = new Date(startedAt);
  cycleStart.setHours(0, 0, 0, 0);
  const cycleEnd = new Date(startedAt);
  cycleEnd.setHours(23, 59, 59, 999);

  const completedSessions = await prisma.patrolSession.findMany({
    where: {
      assignment: {
        employeeId,
        siteId,
        shiftId,
      },
      status: 'COMPLETED',
      startedAt: {
        gte: cycleStart,
        lte: cycleEnd,
      },
    },
    include: {
      assignment: {
        include: {
          employee: true,
          site: true,
          shift: true,
          patrolRoute: {
            include: {
              routeGates: { include: { gate: true } },
            },
          },
          assignmentGates: { include: { gate: true } },
        },
      },
      checkpoints: {
        include: {
          gate: true,
          subTaskResponses: true,
        },
        orderBy: { scannedAt: 'asc' },
      },
      incidents: true,
      snags: true,
    },
    orderBy: { startedAt: 'asc' },
  });

  // Track distinct completed route IDs
  const completedDistinctRouteIds = new Set<string>();
  completedSessions.forEach((sess) => {
    const routeId = sess.assignment?.patrolRouteId || sess.assignmentId;
    if (routeId) {
      completedDistinctRouteIds.add(routeId);
    }
  });

  const completedRoutesCount = completedDistinctRouteIds.size;

  // 5. Check if ALL assigned routes have been completed at least once
  if (completedRoutesCount < totalAssignedRoutesCount) {
    logger.info(
      `ℹ️ Patrol cycle incomplete for ${officerName} (${completedRoutesCount}/${totalAssignedRoutesCount} assigned routes completed). Email delayed until all routes are finished.`,
    );
    return;
  }

  logger.info(
    `🎉 ALL assigned routes completed for ${officerName}! (${completedRoutesCount}/${totalAssignedRoutesCount} routes). Preparing consolidated email.`,
  );

  // 6. Enforce Idempotency — cycle notification key
  const cycleKey = `CYCLE_${employeeId}_${siteId}_${shiftId}_${cycleDate}`;

  const defaultPublicApi = 'https://orbit.helloentry.com/api/v1';
  const baseUrl = (process.env.PUBLIC_API_URL || process.env.API_URL || defaultPublicApi).replace(/\/+$/, '');
  const defaultWebApp = 'https://orbit.helloentry.com';
  const webAppBaseUrl = (process.env.WEB_APP_URL || process.env.FRONTEND_URL || defaultWebApp).replace(/\/+$/, '');
  const formatTime = (d?: Date | null) => (d ? formatPatrolTime(d) : 'N/A');

  // 7. Aggregate data across completed sessions
  let totalCheckpointsScanned = 0;
  let totalCheckpointsCount = 0;
  let totalObservationsCount = 0;
  let totalComplianceSum = 0;

  const routesSummaryList: RouteSummaryItem[] = completedSessions.map((sess) => {
    const routeName = sess.assignment?.patrolRoute?.name || 'Direct Checkpoints';
    const isDirectAssignment =
      sess.assignment?.assignmentType === 'DIRECT_CHECKPOINTS' ||
      (!sess.assignment?.patrolRoute &&
        sess.assignment?.assignmentGates &&
        sess.assignment.assignmentGates.length > 0);

    const totalGates = isDirectAssignment
      ? sess.assignment?.assignmentGates?.length || 0
      : sess.assignment?.patrolRoute?.routeGates?.length || 0;

    const scannedCount = new Set((sess.checkpoints || []).map((cp: any) => cp.gateId)).size;
    const compliancePercentage = totalGates > 0 ? Math.round((scannedCount / totalGates) * 100) : 100;

    const observations: Array<{ title: string; description?: string }> = [];
    (sess.checkpoints || []).forEach((cp: any) => {
      cp.subTaskResponses?.forEach((str: any) => {
        if (str.remarks || str.images?.length) {
          observations.push({
            title: `Checkpoint: ${cp.gate?.name || 'Gate'} — Subtask Remark`,
            description: str.remarks || undefined,
          });
        }
      });
    });

    totalCheckpointsScanned += scannedCount;
    totalCheckpointsCount += totalGates;
    totalObservationsCount += observations.length;
    totalComplianceSum += compliancePercentage;

    const token = generateReportDownloadToken(sess.id, clientId);
    const reportDownloadUrl = `${baseUrl}/reports/public/download-pdf?token=${token}`;
    const webAppReportsUrl = `${webAppBaseUrl}/dashboard/reports?patrolSessionId=${encodeURIComponent(sess.id)}&search=${encodeURIComponent(sess.patrolCode)}`;

    return {
      routeName,
      patrolCode: sess.patrolCode,
      scannedCount,
      totalCount: totalGates,
      compliancePercentage,
      observationsCount: observations.length,
      completedAt: formatTime(sess.endedAt),
      reportDownloadUrl,
      webAppReportsUrl,
      checkpoints: (sess.checkpoints || []).map((cp: any, idx: number) => ({
        name: cp.gate?.name || `Checkpoint #${idx + 1}`,
        sequence: cp.gate?.sequence || idx + 1,
        scannedAt: formatTime(cp.scannedAt),
      })),
      observations,
    };
  });

  const overallCompliancePercentage =
    completedSessions.length > 0
      ? Math.round(totalComplianceSum / completedSessions.length)
      : 100;

  const emailHtml = buildConsolidatedRouteCycleEmailHtml({
    officerName,
    employeeId: employeeNumber,
    officerRole,
    siteName,
    shiftName,
    cycleDate,
    assignedRoutesCount: totalAssignedRoutesCount,
    completedRoutesCount,
    overallCompliancePercentage,
    totalCheckpointsScanned,
    totalCheckpointsCount,
    totalObservationsCount,
    routes: routesSummaryList,
  });

  const subject = `Assigned Patrol Routes Completed — ${officerName} — ${siteName}`;

  // 8. Send consolidated email to recipients with idempotency check
  for (const recipient of activeRecipients) {
    let delivery = await clientNotificationRepository.getDelivery(
      'ROUTE_CYCLE_COMPLETED',
      cycleKey,
      recipient,
    );

    if (delivery && delivery.status === NotificationStatus.SENT) {
      logger.info(`⏩ Cycle notification already SENT to ${recipient} for cycle ${cycleKey}. Skipping.`);
      continue;
    }

    if (!delivery) {
      delivery = await clientNotificationRepository.createDelivery({
        clientId,
        patrolSessionId: cycleKey,
        type: 'ROUTE_CYCLE_COMPLETED',
        recipient,
        status: NotificationStatus.PROCESSING,
      });
    } else {
      await clientNotificationRepository.updateDeliveryStatus(delivery.id, {
        status: NotificationStatus.PROCESSING,
      });
    }

    const currentAttempts = (delivery.attempts || 0) + 1;

    const result = await emailProvider.send({
      to: recipient,
      subject,
      html: emailHtml,
    });

    if (result.success) {
      await clientNotificationRepository.updateDeliveryStatus(delivery.id, {
        status: NotificationStatus.SENT,
        attempts: currentAttempts,
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      });
      logger.info(`✅ Delivered consolidated route cycle notification to ${recipient} for cycle ${cycleKey}`);
    } else {
      await clientNotificationRepository.updateDeliveryStatus(delivery.id, {
        status: NotificationStatus.FAILED,
        attempts: currentAttempts,
        errorMessage: result.error,
      });
      logger.error(`❌ Cycle notification delivery failed for ${recipient}: ${result.error}`);
    }
  }
}

// Start BullMQ Worker process if Redis connection is active
export function startNotificationWorker() {
  try {
    if (redisConfig.url) {
      const redisConnection = new Redis(redisConfig.url, {
        maxRetriesPerRequest: null,
      });

      const worker = new Worker(
        COMPLETED_PATROL_QUEUE_NAME,
        async (job: Job) => {
          const { patrolSessionId, clientId } = job.data;
          await processCompletedPatrolNotification(patrolSessionId, clientId);
        },
        {
          connection: redisConnection as any,
          concurrency: 5,
        },
      );

      worker.on('completed', (job: Job) => {
        logger.info(`🎉 BullMQ Job ${job.id} completed successfully`);
      });

      worker.on('failed', (job: Job | undefined, err: Error) => {
        logger.error(`💥 BullMQ Job ${job?.id} failed: ${err.message}`);
      });

      logger.info(`👷 Notification Worker listening on queue: ${COMPLETED_PATROL_QUEUE_NAME}`);
    }
  } catch (err: any) {
    logger.warn(`⚠️ Could not start BullMQ worker: ${err.message}`);
  }
}
