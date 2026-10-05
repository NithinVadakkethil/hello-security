import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { gateController } from './gate.controller';
import gateSubTaskRoutes from '../gate-sub-task/gate-sub-task.routes';
import { checkpointCategoryController } from '../checkpoint-category/checkpoint-category.controller';

const router: Router = Router();

// Delete all subtasks for client scope (aliases)
router.delete(
  ['/sub-tasks/all', '/subtasks/all'],
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  checkpointCategoryController.deleteAllSubTasks.bind(checkpointCategoryController),
);

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
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  gateController.list.bind(gateController),
);

router.get(
  '/floors',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  gateController.getFloors.bind(gateController),
);


router.get(
  '/next-sequence',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  gateController.getNextSequence.bind(gateController),
);

router.get(
  '/bulk-range',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN),
  gateController.getBulkRange.bind(gateController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
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
