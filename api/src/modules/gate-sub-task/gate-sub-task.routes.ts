import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { gateSubTaskController } from './gate-sub-task.controller';

const router: Router = Router({ mergeParams: true });

router.post(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  gateSubTaskController.create.bind(gateSubTaskController),
);

router.get(
  '/',
  authenticate,
  gateSubTaskController.list.bind(gateSubTaskController),
);

router.patch(
  '/reorder',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  gateSubTaskController.reorder.bind(gateSubTaskController),
);

router.get(
  '/:id',
  authenticate,
  gateSubTaskController.get.bind(gateSubTaskController),
);

router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  gateSubTaskController.update.bind(gateSubTaskController),
);

router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  gateSubTaskController.delete.bind(gateSubTaskController),
);

export default router;
