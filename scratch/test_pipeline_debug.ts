import { prisma } from '../api/src/database/prisma';
import { clientNotificationRepository } from '../api/src/modules/client-notification/client-notification.repository';
import { patrolSessionService } from '../api/src/modules/patrol-session/patrol-session.service';
import { emailProvider } from '../api/src/common/email/SmtpEmailProvider';
import { processCompletedPatrolNotification } from '../api/src/workers/notification-worker';

async function runPipelineDebug() {
  console.log('==================================================');
  console.log('PATROL COMPLETED EMAIL NOTIFICATION PIPELINE DEBUG');
  console.log('==================================================\n');

  // 1. Check Settings
  const client = await prisma.client.findFirst({ where: { companyName: 'Vespa' } });
  if (!client) {
    console.error('FAIL: Test client "Vespa" not found');
    process.exit(1);
  }
  console.log(`[STAGE 1] Client Found: ${client.companyName} (${client.id})`);

  const settings = await clientNotificationRepository.getSettings(client.id);
  console.log(`[STAGE 1] Settings Persisted: Enabled=${settings.patrolCompletedEmailEnabled}`);
  console.log(`[STAGE 1] Recipients Count: ${settings.recipients.length}`);
  settings.recipients.forEach((r) => console.log(`   - ${r.email} (active: ${r.isActive})`));

  if (!settings.patrolCompletedEmailEnabled || settings.recipients.length === 0) {
    console.log('⚠️ Setting notification preferences to enabled with nithinvadakkethil18@gmail.com...');
    await clientNotificationRepository.updateSettings(client.id, {
      patrolCompletedEmailEnabled: true,
      recipients: ['nithinvadakkethil18@gmail.com'],
    });
  }

  // 2. Direct Email Provider Test
  console.log('\n[STAGE 2] Direct EmailProvider Test:');
  const directResult = await emailProvider.send({
    to: 'nithinvadakkethil18@gmail.com',
    subject: 'Pipeline Test Direct Email',
    html: '<p>Direct email test payload</p>',
  });
  console.log(`[STAGE 2] Direct Email Result: Success=${directResult.success}, msgId=${directResult.providerMessageId}, err=${directResult.error}`);

  // 3. Create active assignment, start patrol session, scan checkpoint, and complete
  console.log('\n[STAGE 3] Creating Real Patrol Session with Scanned Checkpoints:');
  const emp = await prisma.employee.findFirst({ where: { clientId: client.id, role: 'SECURITY' } });
  const site = await prisma.site.findFirst({ where: { clientId: client.id } });
  const shift = await prisma.shift.findFirst({ where: { clientId: client.id } });
  const route = await prisma.patrolRoute.findFirst({ where: { siteId: site?.id }, include: { routeGates: { include: { gate: true } } } });

  if (!emp || !site || !shift || !route || !route.routeGates.length) {
    console.error('FAIL: Seed data incomplete (emp/site/shift/route missing)');
    process.exit(1);
  }

  // Cleanup old test assignments/sessions for this client
  await prisma.notificationDelivery.deleteMany({ where: { clientId: client.id } });
  await prisma.patrolCheckpoint.deleteMany({ where: { patrolSession: { clientId: client.id } } });
  await prisma.patrolSession.deleteMany({ where: { clientId: client.id } });
  await prisma.guardAssignment.deleteMany({ where: { employeeId: emp.id } });

  const assignment = await prisma.guardAssignment.create({
    data: {
      clientId: client.id,
      employeeId: emp.id,
      siteId: site.id,
      shiftId: shift.id,
      patrolRouteId: route.id,
      effectiveFrom: new Date(),
      effectiveTo: new Date(Date.now() + 86400000),
      isActive: true,
    },
  });

  const session = await patrolSessionService.start(client.id, emp.id, assignment.id);
  console.log(`[STAGE 3] Patrol Session Started: ${session.patrolCode} (${session.id})`);

  // Scan a checkpoint
  const firstGate = route.routeGates[0].gate;
  await prisma.patrolCheckpoint.create({
    data: {
      patrolSessionId: session.id,
      gateId: firstGate.id,
      scannedAt: new Date(),
      images: [],
    },
  });
  console.log(`[STAGE 3] Scanned Checkpoint: ${firstGate.name} (${firstGate.gateCode})`);

  // Complete Patrol
  const completed = await patrolSessionService.complete(session.id, 'Test completion remarks');
  console.log(`[STAGE 3] Patrol Completed: Status=${completed.status}, Duration=${completed.totalDuration} mins`);

  // 4. Manually trigger worker processing (or wait for queue)
  console.log('\n[STAGE 4] Executing Worker Notification Processing:');
  await processCompletedPatrolNotification(session.id, client.id);

  // 5. Inspect NotificationDelivery records
  console.log('\n[STAGE 5] Inspecting NotificationDelivery Records in DB:');
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { patrolSessionId: session.id },
  });
  console.log(`[STAGE 5] Found ${deliveries.length} delivery records:`);
  deliveries.forEach((d) => {
    console.log(`   - ID: ${d.id} | Recipient: ${d.recipient} | Status: ${d.status} | ProviderMsgId: ${d.providerMessageId} | Error: ${d.errorMessage}`);
  });

  console.log('\n==================================================');
  console.log('PIPELINE DEBUG COMPLETE');
  console.log('==================================================');
}

runPipelineDebug()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Pipeline Debug Error:', err);
    process.exit(1);
  });
