import { NotificationStatus } from '@prisma/client';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { clientNotificationRepository } from '../modules/client-notification/client-notification.repository';
import { patrolSessionRepository } from '../modules/patrol-session/patrol-session.repository';
import { emailProvider } from '../common/email/SmtpEmailProvider';
import { buildPatrolCompletedEmailHtml } from '../common/email/templates/patrol-completed.template';
import { logger } from '../common/logger/logger';
import { redisConfig } from '../config/redis.config';
import { COMPLETED_PATROL_QUEUE_NAME } from '../common/queue/notification-queue.service';
import { generateReportDownloadToken } from '../common/auth/report-token';

export async function processCompletedPatrolNotification(
  patrolSessionId: string,
  clientId: string,
) {
  logger.info(`🔍 Worker processing completed patrol notification for session: ${patrolSessionId}`);

  // 1. Load client notification settings & recipients
  const settings = await clientNotificationRepository.getSettings(clientId);

  if (!settings.patrolCompletedEmailEnabled) {
    logger.info(`ℹ️ Patrol completed notifications disabled for client ${clientId}. Skipping.`);
    return;
  }

  const activeRecipients = settings.recipients.filter((r: any) => r.isActive).map((r: any) => r.email);

  if (activeRecipients.length === 0) {
    logger.info(`ℹ️ No active notification recipients configured for client ${clientId}. Skipping.`);
    return;
  }

  // 2. Load completed patrol details
  const patrol = await patrolSessionRepository.findFullById(patrolSessionId);

  if (!patrol) {
    logger.error(`❌ Patrol session ${patrolSessionId} not found. Cannot send notification.`);
    return;
  }

  // Ensure patrol session belongs to tenant client
  if (patrol.clientId !== clientId) {
    logger.error(`CRITICAL TENANT ERROR: Patrol session clientId (${patrol.clientId}) does not match job clientId (${clientId}).`);
    return;
  }

  // Calculate report metrics
  const officerName = `${patrol.assignment.employee.firstName} ${patrol.assignment.employee.lastName}`;
  const employeeId = patrol.assignment.employee.employeeNumber;
  const siteName = patrol.assignment.site.name;
  const routeName = patrol.assignment.patrolRoute?.name || 'Direct Checkpoints';
  const shiftName = `${patrol.assignment.shift.name} (${patrol.assignment.shift.startTime} - ${patrol.assignment.shift.endTime})`;

  const scannedCount = patrol.checkpoints.length;
  const totalGates =
    patrol.assignment.patrolRoute?.routeGates?.length ||
    patrol.assignment.assignmentGates?.length ||
    0;
  const compliancePercentage =
    totalGates > 0 ? Math.round((scannedCount / totalGates) * 100) : 100;

  // Gather observations / snags across scanned checkpoints
  const observations: Array<{ title: string; description?: string }> = [];
  patrol.checkpoints.forEach((cp) => {
    cp.subTaskResponses?.forEach((str) => {
      if (str.remarks || str.images?.length) {
        observations.push({
          title: `Checkpoint: ${cp.gate?.name || 'Gate'} — Subtask Observation`,
          description: str.remarks || undefined,
        });
      }
    });
  });

  const supervisorStatus = patrol.verificationStatus
    ? patrol.verificationStatus
    : 'Pending';

  const formatTime = (d?: Date | null) => (d ? new Date(d).toLocaleString() : 'N/A');

  const token = generateReportDownloadToken(patrolSessionId, clientId);
  const isProd = process.env.NODE_ENV === 'production';
  const defaultPublicApi = isProd ? 'https://orbit.helloentry.com/api/v1' : 'http://localhost:3001/api/v1';
  const baseUrl = (process.env.PUBLIC_API_URL || process.env.API_URL || defaultPublicApi).replace(/\/+$/, '');
  const reportDownloadUrl = `${baseUrl}/reports/public/download-pdf?token=${token}`;

  const defaultWebApp = isProd ? 'https://orbit.helloentry.com' : 'http://localhost:3000';
  const webAppBaseUrl = (process.env.WEB_APP_URL || process.env.FRONTEND_URL || defaultWebApp).replace(/\/+$/, '');
  const webAppReportsUrl = `${webAppBaseUrl}/dashboard/reports?patrolSessionId=${encodeURIComponent(patrolSessionId)}&search=${encodeURIComponent(patrol.patrolCode)}`;

  const emailHtml = buildPatrolCompletedEmailHtml({
    patrolCode: patrol.patrolCode,
    officerName,
    employeeId,
    siteName,
    routeName,
    shiftName,
    startedAt: formatTime(patrol.startedAt),
    completedAt: formatTime(patrol.endedAt),
    scannedCount,
    totalCount: totalGates,
    compliancePercentage,
    observationsCount: observations.length,
    supervisorStatus,
    checkpoints: patrol.checkpoints.map((cp, idx) => ({
      name: cp.gate?.name || `Checkpoint #${idx + 1}`,
      sequence: cp.gate?.sequence || idx + 1,
      scannedAt: formatTime(cp.scannedAt),
    })),
    observations,
    reportDownloadUrl,
    webAppReportsUrl,
  });

  const subject = `Patrol Completed — ${siteName} — ${patrol.patrolCode}`;

  // 3. Send email to each active recipient with idempotency and delivery tracking
  for (const recipient of activeRecipients) {
    let delivery = await clientNotificationRepository.getDelivery(
      'PATROL_COMPLETED',
      patrolSessionId,
      recipient,
    );

    if (delivery && delivery.status === NotificationStatus.SENT) {
      logger.info(`⏩ Notification already SENT to ${recipient} for session ${patrolSessionId}. Skipping.`);
      continue;
    }

    if (!delivery) {
      delivery = await clientNotificationRepository.createDelivery({
        clientId,
        patrolSessionId,
        type: 'PATROL_COMPLETED',
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
      logger.info(`✅ Delivered patrol completed notification to ${recipient}`);
    } else {
      await clientNotificationRepository.updateDeliveryStatus(delivery.id, {
        status: NotificationStatus.FAILED,
        attempts: currentAttempts,
        errorMessage: result.error,
      });
      logger.error(`❌ Delivery failed for ${recipient}: ${result.error}`);
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
