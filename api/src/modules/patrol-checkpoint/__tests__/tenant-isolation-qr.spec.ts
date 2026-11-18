import { PatrolStatus, UserRole } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { AppError } from '../../../common/errors/AppError';
import { HttpStatus } from '../../../common/errors/HttpStatus';
import { CurrentUser } from '../../../common/auth/current-user';
import { assertTenantAccess } from '../../../common/auth/tenant-access';
import { authenticate } from '../../../common/auth/auth.middleware';
import { signAccessToken, signRefreshToken } from '../../../common/auth/jwt';
import { authService } from '../../auth/auth.service';
import { authRepository } from '../../auth/auth.repository';
import { hashPassword } from '../../../common/auth/bcrypt';
import { patrolCheckpointService } from '../patrol-checkpoint.service';
import { patrolCheckpointRepository } from '../patrol-checkpoint.repository';
import { patrolSessionRepository } from '../../patrol-session/patrol-session.repository';
import { gateSubTaskService } from '../../gate-sub-task/gate-sub-task.service';
import { gateSubTaskRepository } from '../../gate-sub-task/gate-sub-task.repository';
import { siteService } from '../../site/site.service';
import { siteRepository } from '../../site/site.repository';
import { gateService } from '../../gate/gate.service';
import { gateRepository } from '../../gate/gate.repository';
import { patrolRouteService } from '../../patrol-route/patrol-route.service';
import { patrolRouteRepository } from '../../patrol-route/patrol-route.repository';
import { patrolSessionService } from '../../patrol-session/patrol-session.service';
import { employeeService } from '../../employee/employee.service';
import { employeeRepository } from '../../employee/employee.repository';
import { shiftService } from '../../shift/shift.service';
import { shiftRepository } from '../../shift/shift.repository';
import { incidentService } from '../../incident/incident.service';
import { incidentRepository } from '../../incident/incident.repository';

describe('Multi-Tenant Separation & Physical QR Isolation', () => {
  const rt10ClientId = 'cmspzj3lz0054hp189gaym6ky'; // KAIZEN - Herculas (RT-10)
  const rt11ClientId = 'new-cleopatra-client-id'; // New independent RT-11 tenant
  const rt10SiteId = 'cmsq074j2005jhp18vyzarosu';
  const rt11SiteId = 'cmsya0knf000ohp6t7e2qselw';
  const rt11PhysicalQrGateId = 'rt11-gate-cuid-0001';

  const rt10Admin: CurrentUser = {
    id: 'user-rt10-admin',
    tenantId: rt10ClientId,
    employeeId: null,
    email: 'kaizen.legend@helloorbit.com',
    role: UserRole.CLIENT_ADMIN,
  };

  const rt11Admin: CurrentUser = {
    id: 'user-rt11-admin',
    tenantId: rt11ClientId,
    employeeId: null,
    email: 'ct.kaizen@helloorbit.com',
    role: UserRole.CLIENT_ADMIN,
  };

  const superAdmin: CurrentUser = {
    id: 'user-super-admin',
    tenantId: null,
    employeeId: null,
    email: 'super@helloorbit.com',
    role: UserRole.SUPER_ADMIN,
  };

  const regionalManager: CurrentUser = {
    id: 'user-manager-1',
    tenantId: null,
    employeeId: null,
    email: 'manager@helloorbit.com',
    role: UserRole.MANAGER,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Physical QR Code (Gate.id) & Guard Scan Tenant Isolation', () => {
    it('allows RT-11 guard to scan existing physical RT-11 QR (Gate.id) under new clientId', async () => {
      const rt11GuardUser = {
        id: 'user-ikram',
        employeeId: 'emp-ikram',
        clientId: rt11ClientId,
        role: UserRole.SECURITY,
        employee: { id: 'emp-ikram', role: UserRole.SECURITY },
      };
      const rt11PatrolSession = {
        id: 'session-rt11-1',
        clientId: rt11ClientId,
        status: PatrolStatus.IN_PROGRESS,
        startedAt: new Date('2026-11-11T08:00:00Z'),
        assignmentId: 'assign-rt11-1',
        assignment: {
          id: 'assign-rt11-1',
          clientId: rt11ClientId,
          siteId: rt11SiteId,
          employeeId: 'emp-ikram',
          patrolRoute: { routeGates: [{ gateId: rt11PhysicalQrGateId }] },
        },
      };
      const rt11Gate = {
        id: rt11PhysicalQrGateId,
        gateCode: 'GATE-000001',
        qrCode: null,
        siteId: rt11SiteId,
        isActive: true,
        updatedAt: new Date('2026-09-01T00:00:00Z'),
        site: { id: rt11SiteId, clientId: rt11ClientId },
      };

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(rt11GuardUser as any);
      jest.spyOn(patrolSessionRepository, 'findFullById').mockResolvedValue(rt11PatrolSession as any);
      const gateFindSpy = jest.spyOn(prisma.gate, 'findFirst').mockResolvedValue(rt11Gate as any);
      jest.spyOn(prisma.gateSubTask, 'count').mockResolvedValue(1);
      jest.spyOn(prisma.gateSubTask, 'findMany').mockResolvedValue([] as any);
      jest.spyOn(prisma.patrolCheckpoint, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const fakeTx = {
          patrolCheckpoint: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'cp-1', gateId: rt11PhysicalQrGateId }),
            findUnique: jest.fn().mockResolvedValue({
              id: 'cp-1',
              gateId: rt11PhysicalQrGateId,
              gate: rt11Gate,
              subTaskResponses: [],
            }),
          },
          patrolSubTaskResponse: { findFirst: jest.fn(), create: jest.fn() },
        };
        return cb(fakeTx);
      });
      jest.spyOn(patrolCheckpointRepository, 'countBySession').mockResolvedValue(1);

      const res = await patrolCheckpointService.scan('emp-ikram', {
        gateId: rt11PhysicalQrGateId,
        patrolSessionId: 'session-rt11-1',
      });

      expect(res.checkpoint?.gateId).toBe(rt11PhysicalQrGateId);
      // Confirm gateCode lookup in the OR filter was strictly scoped to rt11SiteId
      expect(gateFindSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([
              { id: rt11PhysicalQrGateId },
              { gateCode: rt11PhysicalQrGateId, siteId: rt11SiteId },
            ]),
          },
          include: { site: true },
        }),
      );
    });

    it('blocks RT-10 guard from scanning an RT-11 physical QR (Gate.id)', async () => {
      const rt10GuardUser = {
        id: 'user-rt10-guard',
        employeeId: 'emp-rt10-1',
        clientId: rt10ClientId,
        role: UserRole.SECURITY,
        employee: { id: 'emp-rt10-1', role: UserRole.SECURITY },
      };
      const rt10PatrolSession = {
        id: 'session-rt10-1',
        clientId: rt10ClientId,
        status: PatrolStatus.IN_PROGRESS,
        startedAt: new Date('2026-11-11T08:00:00Z'),
        assignmentId: 'assign-rt10-1',
        assignment: {
          id: 'assign-rt10-1',
          clientId: rt10ClientId,
          siteId: rt10SiteId,
          employeeId: 'emp-rt10-1',
        },
      };
      const foreignRt11Gate = {
        id: rt11PhysicalQrGateId,
        gateCode: 'GATE-000001',
        qrCode: null,
        siteId: rt11SiteId,
        isActive: true,
        site: { id: rt11SiteId, clientId: rt11ClientId },
      };

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(rt10GuardUser as any);
      jest.spyOn(patrolSessionRepository, 'findFullById').mockResolvedValue(rt10PatrolSession as any);
      jest.spyOn(prisma.gate, 'findFirst').mockResolvedValue(foreignRt11Gate as any);

      await expect(
        patrolCheckpointService.scan('emp-rt10-1', {
          gateId: rt11PhysicalQrGateId,
          patrolSessionId: 'session-rt10-1',
        }),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects scanning a gateCode belonging exclusively to another tenant without falling back to assigned gates', async () => {
      const rt10GuardUser = {
        id: 'user-rt10-guard',
        employeeId: 'emp-rt10-1',
        clientId: rt10ClientId,
        role: UserRole.SECURITY,
        employee: { id: 'emp-rt10-1', role: UserRole.SECURITY },
      };
      const rt10PatrolSession = {
        id: 'session-rt10-1',
        clientId: rt10ClientId,
        status: PatrolStatus.IN_PROGRESS,
        startedAt: new Date('2026-11-11T08:00:00Z'),
        assignmentId: 'assign-rt10-1',
        assignment: {
          id: 'assign-rt10-1',
          clientId: rt10ClientId,
          siteId: rt10SiteId,
          employeeId: 'emp-rt10-1',
          assignmentGates: [{ gateId: 'rt10-gate-1' }],
        },
      };

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(rt10GuardUser as any);
      jest.spyOn(patrolSessionRepository, 'findFullById').mockResolvedValue(rt10PatrolSession as any);
      jest
        .spyOn(prisma.gate, 'findFirst')
        .mockResolvedValueOnce(null) // Step 1 scoped lookup finds nothing
        .mockResolvedValueOnce({
          id: 'rt11-only-gate',
          gateCode: 'GATE-000193',
          site: { clientId: rt11ClientId },
        } as any); // Step 4 foreign gateCode check
      jest.spyOn(prisma.guardAssignmentGate, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.patrolRouteGate, 'findFirst').mockResolvedValue(null);

      await expect(
        patrolCheckpointService.scan('emp-rt10-1', {
          gateId: 'GATE-000193',
          patrolSessionId: 'session-rt10-1',
        }),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });
    });

    it('throws NOT_FOUND when unknown gateId has no assignment gates instead of grabbing prisma.gate.findFirst()', async () => {
      const guardUser = {
        id: 'user-guard',
        employeeId: 'emp-1',
        clientId: rt10ClientId,
        role: UserRole.SECURITY,
      };
      const session = {
        id: 'session-1',
        clientId: rt10ClientId,
        status: PatrolStatus.IN_PROGRESS,
        startedAt: new Date(),
        assignmentId: null,
        assignment: null,
      };

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(guardUser as any);
      jest.spyOn(patrolSessionRepository, 'findFullById').mockResolvedValue(session as any);
      jest.spyOn(prisma.gate, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.guardAssignmentGate, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.patrolRouteGate, 'findFirst').mockResolvedValue(null);

      await expect(
        patrolCheckpointService.scan('emp-1', {
          gateId: 'nonexistent-qr',
          patrolSessionId: 'session-1',
        }),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('assertTenantAccess & Cross-Tenant :id Service Guards', () => {
    it('enforces access rules for CLIENT_ADMIN, SUPER_ADMIN, and centralized MANAGER', async () => {
      await expect(assertTenantAccess(rt10Admin, rt10ClientId)).resolves.toBeUndefined();
      await expect(assertTenantAccess(rt10Admin, rt11ClientId)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });
      await expect(assertTenantAccess(superAdmin, rt11ClientId)).resolves.toBeUndefined();

      const membershipSpy = jest
        .spyOn(prisma.managerClientMembership, 'findFirst')
        .mockResolvedValueOnce({ id: 'mem-1' } as any)
        .mockResolvedValueOnce(null);

      await expect(assertTenantAccess(regionalManager, rt10ClientId)).resolves.toBeUndefined();
      await expect(assertTenantAccess(regionalManager, rt11ClientId)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });
      expect(membershipSpy).toHaveBeenCalledTimes(2);
    });

    it('rejects cross-tenant access on Site, Gate, GateSubTask, PatrolRoute, PatrolSession, Employee, Shift, Incident, and Checkpoint History', async () => {
      jest.spyOn(siteRepository, 'findById').mockResolvedValue({
        id: rt11SiteId,
        clientId: rt11ClientId,
      } as any);
      await expect(siteService.get(rt11SiteId, rt10Admin)).rejects.toThrow(AppError);
      await expect(siteService.get(rt11SiteId, rt11Admin)).resolves.toMatchObject({ id: rt11SiteId });

      jest.spyOn(gateRepository, 'findById').mockResolvedValue({
        id: rt11PhysicalQrGateId,
        siteId: rt11SiteId,
      } as any);
      await expect(gateService.get(rt11PhysicalQrGateId, rt10Admin)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });
      await expect(gateService.get(rt11PhysicalQrGateId, rt11Admin)).resolves.toMatchObject({
        id: rt11PhysicalQrGateId,
      });

      jest.spyOn(gateSubTaskRepository, 'findById').mockResolvedValue({
        id: 'gst-rt11-1',
        gateId: rt11PhysicalQrGateId,
        gate: { site: { clientId: rt11ClientId } },
      } as any);
      await expect(gateSubTaskService.get('gst-rt11-1', rt10Admin)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });

      jest.spyOn(prisma.gate, 'findFirst').mockResolvedValue({
        id: rt11PhysicalQrGateId,
        site: { clientId: rt11ClientId },
      } as any);
      jest.spyOn(prisma.gateSubTask, 'count').mockResolvedValue(0);
      await expect(
        gateSubTaskService.reorder(
          rt11PhysicalQrGateId,
          { subTasks: [{ id: 'foreign-gst', displayOrder: 0 }] },
          rt11Admin.id,
          rt11ClientId,
          rt11Admin,
        ),
      ).rejects.toMatchObject({ statusCode: HttpStatus.FORBIDDEN });

      jest.spyOn(patrolRouteRepository, 'findById').mockResolvedValue({
        id: 'route-rt11-1',
        clientId: rt11ClientId,
        routeGates: [],
      } as any);
      await expect(patrolRouteService.get('route-rt11-1', rt10Admin)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });

      jest.spyOn(patrolSessionRepository, 'findFullById').mockResolvedValue({
        id: 'session-rt11-1',
        clientId: rt11ClientId,
      } as any);
      await expect(patrolSessionService.findById('session-rt11-1', rt10Admin)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });

      jest.spyOn(patrolSessionRepository, 'findById').mockResolvedValue({
        id: 'session-rt11-1',
        clientId: rt11ClientId,
        status: PatrolStatus.IN_PROGRESS,
        pauseCount: 0,
      } as any);
      await expect(patrolSessionService.pause('session-rt11-1', rt10Admin)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });

      jest.spyOn(prisma.patrolSession, 'findUnique').mockResolvedValue({
        id: 'session-rt11-1',
        clientId: rt11ClientId,
      } as any);
      await expect(
        patrolCheckpointService.history('session-rt11-1', rt10Admin),
      ).rejects.toMatchObject({ statusCode: HttpStatus.FORBIDDEN });

      jest.spyOn(patrolCheckpointRepository, 'findById').mockResolvedValue({
        id: 'cp-rt11-1',
        patrolSession: { clientId: rt11ClientId },
      } as any);
      await expect(
        patrolCheckpointService.updateRemarks('cp-rt11-1', 'note', rt10Admin),
      ).rejects.toMatchObject({ statusCode: HttpStatus.FORBIDDEN });

      jest.spyOn(employeeRepository, 'findById').mockResolvedValue({
        id: 'emp-rt11-1',
        clientId: rt11ClientId,
      } as any);
      await expect(employeeService.get('emp-rt11-1', rt10Admin)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });

      jest.spyOn(shiftRepository, 'findById').mockResolvedValue({
        id: 'shift-rt11-1',
        clientId: rt11ClientId,
      } as any);
      await expect(shiftService.get('shift-rt11-1', rt10Admin)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });

      jest.spyOn(incidentRepository, 'findById').mockResolvedValue({
        id: 'inc-rt11-1',
        clientId: rt11ClientId,
      } as any);
      await expect(incidentService.findById('inc-rt11-1', rt10Admin)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });
      await expect(
        incidentService.updateStatus('inc-rt11-1', 'RESOLVED', rt10Admin),
      ).rejects.toMatchObject({ statusCode: HttpStatus.FORBIDDEN });
    });
  });

  describe('Auth Middleware & Token Refresh Disabled-Account Guards', () => {
    it('rejects inactive users during refresh and logoutAllDevices', async () => {
      const realRefreshToken = signRefreshToken({
        sub: 'user-rt11-disabled',
        tenantId: rt10ClientId,
        employeeId: 'emp-ikram',
        email: 'ikram@ct.com',
        role: UserRole.SECURITY,
      });
      jest.spyOn(authRepository, 'findUserById').mockResolvedValue({
        id: 'user-rt11-disabled',
        isActive: false,
        clientId: rt11ClientId,
      } as any);

      await expect(authService.refresh(realRefreshToken)).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });

      const realHash = await hashPassword('pass123');
      jest.spyOn(authRepository, 'findUserByEmail').mockResolvedValue({
        id: 'user-rt11-disabled',
        isActive: false,
        password: realHash,
      } as any);

      await expect(
        authService.logoutAllDevices('ikram@ct.com', 'pass123', 'dev-1'),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.FORBIDDEN,
      });
    });

    it('authenticate middleware checks live DB isActive & overrides stale JWT tenantId', async () => {
      const realAccessToken = signAccessToken({
        sub: 'user-migrated',
        tenantId: rt10ClientId, // stale pre-migration claim
        employeeId: 'emp-ikram',
        email: 'ikram@ct.com',
        role: UserRole.SECURITY,
      });

      // Case 1: Disabled account is blocked immediately
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        isActive: false,
        clientId: rt11ClientId,
        employeeId: 'emp-ikram',
        role: UserRole.SECURITY,
        supervisedRole: null,
      } as any);

      const reqDisabled: any = {
        headers: { authorization: `Bearer ${realAccessToken}` },
        originalUrl: '/api/v1/sites',
      };
      const nextDisabled = jest.fn();
      await authenticate(reqDisabled, {} as any, nextDisabled);
      expect(nextDisabled.mock.calls[0][0]).toMatchObject({ statusCode: HttpStatus.FORBIDDEN });

      // Case 2: Active migrated user resolves live clientId from DB
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        isActive: true,
        clientId: rt11ClientId,
        employeeId: 'emp-ikram',
        role: UserRole.SECURITY,
        supervisedRole: null,
      } as any);
      jest.spyOn(prisma.employee, 'findUnique').mockResolvedValueOnce({
        role: UserRole.SECURITY,
        siraCardExpiryDate: null,
      } as any);

      const reqActive: any = {
        headers: { authorization: `Bearer ${realAccessToken}` },
        originalUrl: '/api/v1/sites',
      };
      const nextActive = jest.fn();
      await authenticate(reqActive, {} as any, nextActive);
      expect(nextActive).toHaveBeenCalledWith();
      expect(reqActive.user.tenantId).toBe(rt11ClientId);
    });

    it('manager authorizeManagerScan scopes gateCode by clientContextId and enforces membership', async () => {
      jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'user-manager-1',
        role: UserRole.MANAGER,
        employee: null,
      } as any);
      const gateSpy = jest.spyOn(prisma.gate, 'findFirst').mockResolvedValue({
        id: rt11PhysicalQrGateId,
        gateCode: 'GATE-000001',
        isActive: true,
        site: { id: rt11SiteId, clientId: rt11ClientId },
      } as any);
      jest.spyOn(prisma.managerClientMembership, 'findFirst').mockResolvedValue(null);

      await expect(
        patrolCheckpointService.authorizeManagerScan(
          'user-manager-1',
          'GATE-000001',
          rt11ClientId,
        ),
      ).rejects.toMatchObject({ statusCode: HttpStatus.FORBIDDEN });

      expect(gateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([
              { gateCode: 'GATE-000001', site: { clientId: rt11ClientId } },
            ]),
          },
        }),
      );
    });
  });
});
