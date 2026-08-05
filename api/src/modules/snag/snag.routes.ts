import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';
import { snagController } from './snag.controller';

import { OPERATIONAL_ROLES } from '../../common/auth/constants';

const router: Router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR, UserRole.CLIENT_ADMIN, UserRole.MANAGER),
  (req, res, next) => snagController.create(req, res).catch(next)
);

router.get(
  '/',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, ...OPERATIONAL_ROLES),
  (req, res, next) => snagController.list(req, res).catch(next)
);

router.get(
  '/stats',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  (req, res, next) => snagController.getStats(req, res).catch(next)
);

router.get(
  '/:id',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, ...OPERATIONAL_ROLES),
  (req, res, next) => snagController.get(req, res).catch(next)
);

router.patch(
  '/:id/status',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, ...OPERATIONAL_ROLES),
  (req, res, next) => snagController.updateStatus(req, res).catch(next)
);

router.post(
  '/:id/comments',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  (req, res, next) => snagController.addComment(req, res).catch(next)
);

router.post(
  '/:id/assign',
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  (req, res, next) => snagController.assign(req, res).catch(next)
);

export default router;
