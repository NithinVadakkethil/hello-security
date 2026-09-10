import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { OPERATIONAL_ROLES } from '../../common/auth/constants';

import { patrolCheckpointController } from './patrol-checkpoint.controller';

const router: Router = Router();

router.use(authenticate);

router.post(
  '/authorize-scan',
  authorize(UserRole.MANAGER, UserRole.SUPER_ADMIN),
  patrolCheckpointController.authorizeScan,
);

router.post(
  '/scan',
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR, UserRole.MANAGER),
  patrolCheckpointController.scan,
);

router.get(
  '/history/:sessionId',
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.CLIENT_ADMIN),
  patrolCheckpointController.history,
);

router.patch(
  '/:id/remarks',
  authorize(UserRole.SUPERVISOR, UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  patrolCheckpointController.updateRemarks.bind(patrolCheckpointController),
);

export default router;
