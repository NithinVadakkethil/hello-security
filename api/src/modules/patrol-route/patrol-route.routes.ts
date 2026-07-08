import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { patrolRouteController } from './patrol-route.controller';

const router: Router = Router();

router.post(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  patrolRouteController.create.bind(patrolRouteController),
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  patrolRouteController.list.bind(patrolRouteController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  patrolRouteController.get.bind(patrolRouteController),
);

router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  patrolRouteController.update.bind(patrolRouteController),
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  patrolRouteController.activate.bind(patrolRouteController),
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  patrolRouteController.deactivate.bind(patrolRouteController),
);

export default router;
