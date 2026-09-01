import { prisma } from '../api/src/database/prisma';
import { clientNotificationService } from '../api/src/modules/client-notification/client-notification.service';
import { processCompletedPatrolNotification } from '../api/src/workers/notification-worker';
import { patrolSessionService } from '../api/src/modules/patrol-session/patrol-session.service';
import { PatrolStatus } from '@prisma/client';

async function runTests() {
  console.log('==================================================');
  console.log('STARTING COMPLETED PATROL EMAIL NOTIFICATION TESTS');
  console.log('==================================================');

  const ts = Date.now();

  // Setup Test Client A & Client B
  const clientA = await prisma.client.create({
    data: {
      clientCode: `CLT-NOTIF-${ts}-A`,
      companyName: 'Notification Test Company A',
      email: `notifA_${ts}@helloorbit.com`,
    },
  });

  const clientB = await prisma.client.create({
    data: {
      clientCode: `CLT-NOTIF-${ts}-B`,
      companyName: 'Notification Test Company B',
      email: `notifB_${ts}@helloorbit.com`,
    },
  });

  const siteA = await prisma.site.create({
    data: {
      clientId: clientA.id,
      siteCode: `STE-NA-${ts}`,
      name: 'Site Alpha Notifications',
    },
  });

  const shiftA = await prisma.shift.create({
    data: {
      clientId: clientA.id,
      shiftCode: `SHF-NA-${ts}`,
      name: 'Day Shift',
      startTime: '08:00',
      endTime: '16:00',
    },
  });

  const guardA = await prisma.employee.create({
    data: {
      clientId: clientA.id,
      employeeNumber: `EMP-NA-${ts}`,
      firstName: 'Officer',
      lastName: 'Notification',
    },
  });

  const routeA = await prisma.patrolRoute.create({
    data: {
      clientId: clientA.id,
      siteId: siteA.id,
      routeCode: `ROT-NA-${ts}`,
      name: 'Alpha Patrol Route',
    },
  });

  const gateA = await prisma.gate.create({
    data: {
      siteId: siteA.id,
      gateCode: `GATE-NA-${ts}`,
      name: 'Main Entrance Gate',
      qrCode: `QR-GATE-NA-${ts}`,
      sequence: 1,
    },
  });

  await prisma.patrolRouteGate.create({
    data: {
      patrolRouteId: routeA.id,
      gateId: gateA.id,
      sequence: 1,
    },
  });

  const assignmentA = await prisma.guardAssignment.create({
    data: {
      clientId: clientA.id,
      employeeId: guardA.id,
      siteId: siteA.id,
      shiftId: shiftA.id,
      patrolRouteId: routeA.id,
      assignmentType: 'ROUTE',
      effectiveFrom: new Date(),
    },
  });

  try {
    // TEST 1 — Settings Management & Retrieval
    console.log('\n--- TEST 1 — Notification Settings Management ---');
    const updateRes = await clientNotificationService.updateSettings(clientA.id, {
      patrolCompletedEmailEnabled: true,
      recipients: ['security@companya.com', 'operations@companya.com'],
    });

    console.log('Update Result:', updateRes);
    if (
      updateRes.patrolCompletedEmailEnabled === true &&
      updateRes.recipients.length === 2 &&
      updateRes.recipients.includes('security@companya.com') &&
      updateRes.recipients.includes('operations@companya.com')
    ) {
      console.log('✅ [PASS] TEST 1 — Updated notification settings & recipients persisted');
    } else {
      throw new Error('TEST 1 Failed: Settings did not match expected values');
    }

    // TEST 2 — Validation & Deduplication
    console.log('\n--- TEST 2 — Validation & Deduplication ---');
    const dedupRes = await clientNotificationService.updateSettings(clientA.id, {
      patrolCompletedEmailEnabled: true,
      recipients: ['  SECURITY@companya.com ', 'security@companya.com', 'manager@companya.com'],
    });

    if (
      dedupRes.recipients.length === 2 &&
      dedupRes.recipients.includes('security@companya.com') &&
      dedupRes.recipients.includes('manager@companya.com')
    ) {
      console.log('✅ [PASS] TEST 2 — Whitespace trimmed & duplicate emails deduplicated');
    } else {
      throw new Error(`TEST 2 Failed: Expected 2 deduplicated recipients, got ${dedupRes.recipients.length}`);
    }

    try {
      await clientNotificationService.updateSettings(clientA.id, {
        recipients: ['invalid-email-string'],
      });
      throw new Error('TEST 2 Failed: Expected invalid email error');
    } catch (err: any) {
      if (err.message.includes('Invalid email address format')) {
        console.log('✅ [PASS] TEST 2 — Invalid email address format rejected by backend validation');
      } else {
        throw err;
      }
    }

    // TEST 3 — Successful Patrol Completion Notification Delivery
    console.log('\n--- TEST 3 — Patrol Completion & Async Email Delivery ---');
    const session = await patrolSessionService.start(clientA.id, guardA.id, assignmentA.id);

    // Add scanned checkpoint
    await prisma.patrolCheckpoint.create({
      data: {
        patrolSessionId: session.id,
        gateId: gateA.id,
        scannedAt: new Date(),
      },
    });

    // Complete patrol
    const completedSession = await patrolSessionService.complete(session.id, 'Patrol completed normally');
    if (completedSession.status !== PatrolStatus.COMPLETED) {
      throw new Error('TEST 3 Failed: Patrol session status was not COMPLETED');
    }

    // Process notification
    await processCompletedPatrolNotification(session.id, clientA.id);

    // Verify NotificationDelivery log entries
    const deliveries = await prisma.notificationDelivery.findMany({
      where: { patrolSessionId: session.id },
    });

    console.log('Deliveries logged:', deliveries.map((d) => ({ recipient: d.recipient, status: d.status })));

    if (deliveries.length === 2 && deliveries.every((d) => d.status === 'SENT')) {
      console.log('✅ [PASS] TEST 3 — Successfully processed & logged email deliveries to all recipients');
    } else {
      throw new Error(`TEST 3 Failed: Expected 2 SENT delivery logs, got ${deliveries.length}`);
    }

    // TEST 4 — Idempotency / Duplicate Email Prevention
    console.log('\n--- TEST 4 — Idempotency & Duplicate Email Prevention ---');
    await processCompletedPatrolNotification(session.id, clientA.id);

    const recheckDeliveries = await prisma.notificationDelivery.findMany({
      where: { patrolSessionId: session.id },
    });

    if (recheckDeliveries.length === 2 && recheckDeliveries.every((d) => d.attempts === 1)) {
      console.log('✅ [PASS] TEST 4 — Duplicate notification execution safely skipped already sent emails');
    } else {
      throw new Error(`TEST 4 Failed: Expected attempts = 1, got attempts = ${recheckDeliveries[0]?.attempts}`);
    }

    // TEST 5 — Notifications Disabled (OFF Toggle)
    console.log('\n--- TEST 5 — Notifications Disabled (OFF Toggle) ---');
    await clientNotificationService.updateSettings(clientA.id, {
      patrolCompletedEmailEnabled: false,
    });

    const session2 = await patrolSessionService.start(clientA.id, guardA.id, assignmentA.id);
    await prisma.patrolCheckpoint.create({
      data: {
        patrolSessionId: session2.id,
        gateId: gateA.id,
        scannedAt: new Date(),
      },
    });
    await patrolSessionService.complete(session2.id);
    await processCompletedPatrolNotification(session2.id, clientA.id);

    const disabledDeliveries = await prisma.notificationDelivery.findMany({
      where: { patrolSessionId: session2.id },
    });

    if (disabledDeliveries.length === 0) {
      console.log('✅ [PASS] TEST 5 — No notification delivery attempted when feature is disabled');
    } else {
      throw new Error('TEST 5 Failed: Delivery logged while notifications were disabled!');
    }

    // TEST 6 — Quit / Cancelled Patrol
    console.log('\n--- TEST 6 — Quit / Cancelled Patrol ---');
    const session3 = await patrolSessionService.start(clientA.id, guardA.id, assignmentA.id);
    await patrolSessionService.cancel(session3.id);

    const cancelledDeliveries = await prisma.notificationDelivery.findMany({
      where: { patrolSessionId: session3.id },
    });

    if (cancelledDeliveries.length === 0) {
      console.log('✅ [PASS] TEST 6 — Cancelled patrol did not generate completed email notifications');
    } else {
      throw new Error('TEST 6 Failed: Delivery logged for cancelled patrol!');
    }

    // TEST 7 — Tenant Isolation
    console.log('\n--- TEST 7 — Tenant Isolation ---');
    await clientNotificationService.updateSettings(clientB.id, {
      patrolCompletedEmailEnabled: true,
      recipients: ['security@clientb.com'],
    });

    await clientNotificationService.updateSettings(clientA.id, {
      patrolCompletedEmailEnabled: true,
      recipients: ['security@companya.com'],
    });

    const session4 = await patrolSessionService.start(clientA.id, guardA.id, assignmentA.id);
    await prisma.patrolCheckpoint.create({
      data: {
        patrolSessionId: session4.id,
        gateId: gateA.id,
        scannedAt: new Date(),
      },
    });
    await patrolSessionService.complete(session4.id);
    await processCompletedPatrolNotification(session4.id, clientA.id);

    const clientADeliveries = await prisma.notificationDelivery.findMany({
      where: { patrolSessionId: session4.id },
    });

    if (
      clientADeliveries.length === 1 &&
      clientADeliveries[0].recipient === 'security@companya.com' &&
      clientADeliveries[0].clientId === clientA.id
    ) {
      console.log('✅ [PASS] TEST 7 — Tenant isolation strictly restricted emails to Client A recipients');
    } else {
      throw new Error('TEST 7 Failed: Tenant recipient leakage detected!');
    }

    console.log('\n==================================================');
    console.log('ALL 7 COMPLETED PATROL EMAIL NOTIFICATION TESTS PASSED!');
    console.log('==================================================');
  } finally {
    // Clean up test data
    await prisma.notificationDelivery.deleteMany({
      where: { clientId: { in: [clientA.id, clientB.id] } },
    });
    await prisma.notificationRecipient.deleteMany({
      where: { settings: { clientId: { in: [clientA.id, clientB.id] } } },
    });
    await prisma.clientNotificationSettings.deleteMany({
      where: { clientId: { in: [clientA.id, clientB.id] } },
    });
    await prisma.patrolCheckpoint.deleteMany({
      where: { gate: { siteId: siteA.id } },
    });
    await prisma.patrolSession.deleteMany({
      where: { clientId: { in: [clientA.id, clientB.id] } },
    });
    await prisma.guardAssignment.deleteMany({
      where: { siteId: siteA.id },
    });
    await prisma.patrolRouteGate.deleteMany({
      where: { patrolRouteId: routeA.id },
    });
    await prisma.gate.deleteMany({
      where: { siteId: siteA.id },
    });
    await prisma.patrolRoute.deleteMany({
      where: { siteId: siteA.id },
    });
    await prisma.employee.deleteMany({
      where: { clientId: { in: [clientA.id, clientB.id] } },
    });
    await prisma.shift.deleteMany({
      where: { clientId: { in: [clientA.id, clientB.id] } },
    });
    await prisma.site.deleteMany({
      where: { clientId: { in: [clientA.id, clientB.id] } },
    });
    await prisma.client.deleteMany({
      where: { id: { in: [clientA.id, clientB.id] } },
    });
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
