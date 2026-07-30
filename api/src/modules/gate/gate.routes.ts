import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { gateController } from './gate.controller';
import gateSubTaskRoutes from '../gate-sub-task/gate-sub-task.routes';

const router: Router = Router();

router.use('/:gateId/sub-tasks', gateSubTaskRoutes);

router.post(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  gateController.create.bind(gateController),
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  gateController.list.bind(gateController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  gateController.get.bind(gateController),
);

router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  gateController.update.bind(gateController),
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  gateController.activate.bind(gateController),
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  gateController.deactivate.bind(gateController),
);

export default router;
