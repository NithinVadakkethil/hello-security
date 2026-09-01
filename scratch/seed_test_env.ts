import { prisma } from '../api/src/database/prisma';
import { hashPassword } from '../api/src/common/auth/bcrypt';

async function seedTestEnv() {
  const pass = await hashPassword('123456');

  let vespa = await prisma.client.findFirst({ where: { email: 'vespa@gmail.com' } });
  if (!vespa) {
    vespa = await prisma.client.create({
      data: {
        companyName: 'Vespa',
        email: 'vespa@gmail.com',
        phone: '+919876543210',
        address: 'Perinthalmanna',
        clientCode: 'CL-VESPA',
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'vespa@gmail.com' },
    update: { password: pass },
    create: { clientId: vespa.id, email: 'vespa@gmail.com', password: pass, role: 'CLIENT_ADMIN' },
  });

  let empAdhi = await prisma.employee.findFirst({ where: { clientId: vespa.id, employeeNumber: 'EMP-000001' } });
  if (!empAdhi) {
    empAdhi = await prisma.employee.create({
      data: {
        clientId: vespa.id,
        employeeNumber: 'EMP-000001',
        firstName: 'Adhithyan',
        lastName: 'Adhi',
        email: 'adhi@vespa.com',
        role: 'SECURITY',
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'adhi@vespa.com' },
    update: { password: pass, employeeId: empAdhi.id },
    create: { clientId: vespa.id, employeeId: empAdhi.id, email: 'adhi@vespa.com', password: pass, role: 'SECURITY' },
  });

  let empOfficer = await prisma.employee.findFirst({ where: { clientId: vespa.id, employeeNumber: 'EMP-000007' } });
  if (!empOfficer) {
    empOfficer = await prisma.employee.create({
      data: {
        clientId: vespa.id,
        employeeNumber: 'EMP-000007',
        firstName: 'Officer',
        lastName: 'Security',
        email: 'officer@hellosecurity.com',
        role: 'SECURITY',
      },
    });
  }

  await prisma.user.upsert({
    where: { email: 'officer@hellosecurity.com' },
    update: { password: pass, employeeId: empOfficer.id },
    create: { clientId: vespa.id, employeeId: empOfficer.id, email: 'officer@hellosecurity.com', password: pass, role: 'SECURITY' },
  });

  let site = await prisma.site.findFirst({ where: { clientId: vespa.id } });
  if (!site) {
    site = await prisma.site.create({
      data: { clientId: vespa.id, siteCode: 'SITE-001', name: 'Vespa Perinthalmanna', radius: 100 },
    });
  }

  let shift = await prisma.shift.findFirst({ where: { clientId: vespa.id } });
  if (!shift) {
    shift = await prisma.shift.create({
      data: { clientId: vespa.id, shiftCode: 'SHF-001', name: 'Morning Shift', startTime: '06:00', endTime: '14:00' },
    });
  }

  let route = await prisma.patrolRoute.findFirst({ where: { siteId: site.id } });
  if (!route) {
    route = await prisma.patrolRoute.create({
      data: { clientId: vespa.id, siteId: site.id, routeCode: 'RTE-001', name: 'Main Perimeter Route' },
    });

    const gate1 = await prisma.gate.create({ data: { siteId: site.id, gateCode: 'GATE-001', name: 'Main Entrance Gate', sequence: 1 } });
    const gate2 = await prisma.gate.create({ data: { siteId: site.id, gateCode: 'GATE-002', name: 'Rear Exit Gate', sequence: 2 } });

    await prisma.patrolRouteGate.createMany({
      data: [
        { patrolRouteId: route.id, gateId: gate1.id, sequence: 1 },
        { patrolRouteId: route.id, gateId: gate2.id, sequence: 2 },
      ],
    });
  }

  const existingAdhiAsg = await prisma.guardAssignment.findFirst({ where: { employeeId: empAdhi.id } });
  if (!existingAdhiAsg) {
    await prisma.guardAssignment.create({
      data: {
        clientId: vespa.id,
        employeeId: empAdhi.id,
        siteId: site.id,
        shiftId: shift.id,
        patrolRouteId: route.id,
        effectiveFrom: new Date(),
        effectiveTo: new Date(Date.now() + 86400000),
      },
    });
  }

  const existingOfficerAsg = await prisma.guardAssignment.findFirst({ where: { employeeId: empOfficer.id } });
  if (!existingOfficerAsg) {
    await prisma.guardAssignment.create({
      data: {
        clientId: vespa.id,
        employeeId: empOfficer.id,
        siteId: site.id,
        shiftId: shift.id,
        patrolRouteId: route.id,
        effectiveFrom: new Date(),
        effectiveTo: new Date(Date.now() + 86400000),
      },
    });
  }

  await prisma.clientNotificationSettings.upsert({
    where: { clientId: vespa.id },
    update: { patrolCompletedEmailEnabled: true },
    create: {
      clientId: vespa.id,
      patrolCompletedEmailEnabled: true,
      recipients: { create: [{ email: 'nithinvadakkethil18@gmail.com' }] },
    },
  });

  console.log('Successfully seeded rich test environment!');
}

seedTestEnv()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  });
