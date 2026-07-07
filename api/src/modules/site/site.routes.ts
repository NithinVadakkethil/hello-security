import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { siteController } from './site.controller';

const router: Router = Router();

router.post(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.create.bind(siteController),
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.list.bind(siteController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.get.bind(siteController),
);

router.patch(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.update.bind(siteController),
);

router.patch(
  '/:id/activate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.activate.bind(siteController),
);

router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.SUPER_ADMIN),
  siteController.deactivate.bind(siteController),
);

export default router;
