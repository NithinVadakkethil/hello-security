import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { centralManagerController } from './central-manager.controller';

const router: Router = Router();

router.use(authenticate);

const CENTRAL_MANAGER_ROLES = [UserRole.MANAGER, UserRole.SUPER_ADMIN];

router.get(
  '/dashboard',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getDashboard.bind(centralManagerController),
);

router.get(
  '/clients/:clientId/dashboard',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getClientDashboard.bind(centralManagerController),
);

router.get(
  '/employees',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getEmployees.bind(centralManagerController),
);

router.get(
  '/employees/:id',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getEmployeeDetails.bind(centralManagerController),
);

router.get(
  '/patrols',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getPatrols.bind(centralManagerController),
);

router.get(
  '/observations',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getObservations.bind(centralManagerController),
);

router.get(
  '/organizations',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getOrganizations.bind(centralManagerController),
);

router.get(
  '/employee-role-counts',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getEmployeeRoleCounts.bind(centralManagerController),
);

router.get(
  '/snags',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getSnags.bind(centralManagerController),
);

router.get(
  '/reports',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getReports.bind(centralManagerController),
);

router.get(
  '/reports/:id',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getSingleReport.bind(centralManagerController),
);

router.get(
  '/reports/:id/pdf',
  authorize(...CENTRAL_MANAGER_ROLES),
  centralManagerController.getReportPdf.bind(centralManagerController),
);

export default router;
