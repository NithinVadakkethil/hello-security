import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { OPERATIONAL_ROLES } from '../../common/auth/constants';

import { assignmentController } from './assignment.controller';

const router: Router = Router();

router.post(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  assignmentController.create.bind(assignmentController),
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  assignmentController.list.bind(assignmentController),
);

router.get(
  '/active',
  authenticate,
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR),
  assignmentController.getActive.bind(assignmentController),
);

router.get(
  '/active-list',
  authenticate,
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR),
  assignmentController.getActiveList.bind(assignmentController),
);

router.get(
  '/my-assignments',
  authenticate,
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR),
  assignmentController.getMyAssignments.bind(assignmentController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  assignmentController.get.bind(assignmentController),
);

router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  assignmentController.update.bind(assignmentController),
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  assignmentController.activate.bind(assignmentController),
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  assignmentController.deactivate.bind(assignmentController),
);

export default router;
