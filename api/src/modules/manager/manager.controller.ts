import { Request, Response, NextFunction } from 'express';
import { managerMembershipService } from './manager-membership.service';
import { patrolSessionRepository } from '../patrol-session/patrol-session.repository';
import { prisma } from '../../database/prisma';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';

export class ManagerController {
  /**
   * GET /api/v1/manager/clients
   * Returns list of active client memberships for the authenticated manager.
   */
  async getManagerClients(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, 'Unauthorized.');
      }
      const clients = await managerMembershipService.getManagerClients(userId);
      res.status(HttpStatus.OK).json({ success: true, data: clients });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/manager/enroll
   * Admin endpoint to enroll a manager under current organization.
   */
  async enrollManager(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = (req.user?.tenantId || req.body.clientId) as string;
      if (!clientId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Client ID required.');
      }
      const result = await managerMembershipService.enrollManager(clientId, req.body);
      res.status(HttpStatus.CREATED).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/manager/client-list
   * Admin endpoint to list enrolled managers.
   */
  async listClientManagers(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = (req.user?.tenantId || req.query.clientId) as string;
      if (!clientId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Client ID required.');
      }
      const managers = await managerMembershipService.listClientManagers(clientId);
      res.status(HttpStatus.OK).json({ success: true, data: managers });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/manager/client-list/:managerUserId
   * Admin endpoint to deactivate manager membership for an organization.
   */
  async removeManagerMembership(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = (req.user?.tenantId || req.query.clientId) as string;
      const managerUserId = req.params.managerUserId as string;
      if (!clientId || !managerUserId) {
        throw new AppError(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, 'Client ID and Manager User ID required.');
      }
      const result = await managerMembershipService.removeManagerMembership(clientId, managerUserId);
      res.status(HttpStatus.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/manager/clients/:clientId/sites
   * Returns active sites for authorized manager context.
   */
  async getClientSites(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id as string;
      const clientId = req.params.clientId as string;
      await managerMembershipService.assertManagerClientAccess(userId, clientId);

      const sites = await prisma.site.findMany({
        where: { clientId, isActive: true },
        include: {
          _count: {
            select: { gates: true, patrolRoutes: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.status(HttpStatus.OK).json({ success: true, data: sites });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/manager/clients/:clientId/checkpoints
   * Returns searchable checkpoints/gates for authorized manager context.
   */
  async getClientCheckpoints(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id as string;
      const clientId = req.params.clientId as string;
      const siteId = req.query.siteId as string | undefined;
      const search = req.query.search as string | undefined;

      await managerMembershipService.assertManagerClientAccess(userId, clientId);

      const whereClause: any = {
        site: { clientId, isActive: true },
        isActive: true,
      };

      if (siteId) {
        whereClause.siteId = siteId;
      }

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { gateCode: { contains: search, mode: 'insensitive' } },
          { qrCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const checkpoints = await prisma.gate.findMany({
        where: whereClause,
        include: {
          site: {
            select: { id: true, name: true, siteCode: true },
          },
          subTasks: {
            where: { role: 'MANAGER', isActive: true },
            orderBy: { displayOrder: 'asc' },
          },
        },
        orderBy: [{ site: { name: 'asc' } }, { sequence: 'asc' }],
      });

      res.status(HttpStatus.OK).json({ success: true, data: checkpoints });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/manager/clients/:clientId/active-patrols
   * Read-only active employee patrols under client context.
   */
  async getActivePatrols(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id as string;
      const clientId = req.params.clientId as string;

      await managerMembershipService.assertManagerClientAccess(userId, clientId);

      const activePatrols = await prisma.patrolSession.findMany({
        where: {
          clientId,
          status: 'IN_PROGRESS',
        },
        include: {
          assignment: {
            include: {
              employee: true,
              site: true,
              patrolRoute: true,
            },
          },
          checkpoints: {
            select: { id: true, scannedAt: true, gateId: true },
          },
        },
        orderBy: { startedAt: 'desc' },
      });

      res.status(HttpStatus.OK).json({ success: true, data: activePatrols });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/manager/clients/:clientId/completed-patrols
   * Read-only completed employee patrol history under client context.
   */
  async getCompletedPatrols(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id as string;
      const clientId = req.params.clientId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      await managerMembershipService.assertManagerClientAccess(userId, clientId);

      const [completedPatrols, total] = await Promise.all([
        prisma.patrolSession.findMany({
          where: {
            clientId,
            status: 'COMPLETED',
          },
          include: {
            assignment: {
              include: {
                employee: true,
                site: true,
                patrolRoute: true,
              },
            },
            checkpoints: {
              select: { id: true, scannedAt: true, gateId: true },
            },
          },
          orderBy: { endedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.patrolSession.count({
          where: { clientId, status: 'COMPLETED' },
        }),
      ]);

      res.status(HttpStatus.OK).json({
        success: true,
        data: completedPatrols,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/manager/clients/:clientId/patrols/:id
   * Read-only single patrol detail.
   */
  async getPatrolDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id as string;
      const clientId = req.params.clientId as string;
      const id = req.params.id as string;

      await managerMembershipService.assertManagerClientAccess(userId, clientId);

      const patrol = await patrolSessionRepository.findFullById(id);

      if (!patrol || patrol.clientId !== clientId) {
        throw new AppError(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, 'Patrol detail not found.');
      }

      res.status(HttpStatus.OK).json({ success: true, data: patrol });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/manager/centralized-list
   * Super Admin endpoint to list all Centralized Managers.
   */
  async listCentralizedManagers(req: Request, res: Response, next: NextFunction) {
    try {
      const managers = await managerMembershipService.listCentralizedManagers();
      res.status(HttpStatus.OK).json({ success: true, data: managers });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/manager/centralized-enroll
   * Super Admin endpoint to create/update Centralized Manager and set client memberships.
   */
  async enrollCentralizedManager(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await managerMembershipService.enrollCentralizedManager(req.body);
      res.status(HttpStatus.CREATED).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/manager/centralized-memberships/:userId
   * Super Admin endpoint to edit assigned Client Admin organizations for a manager.
   */
  async updateCentralizedMemberships(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const clientIds = req.body.clientIds as string[];
      const result = await managerMembershipService.updateCentralizedMemberships(userId, clientIds);
      res.status(HttpStatus.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/manager/centralized-status/:userId
   * Super Admin endpoint to activate/deactivate Centralized Manager account.
   */
  async setCentralizedManagerStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId as string;
      const isActive = Boolean(req.body.isActive);
      const result = await managerMembershipService.setCentralizedManagerStatus(userId, isActive);
      res.status(HttpStatus.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const managerController = new ManagerController();
