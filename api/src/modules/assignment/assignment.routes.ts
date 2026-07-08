import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

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
