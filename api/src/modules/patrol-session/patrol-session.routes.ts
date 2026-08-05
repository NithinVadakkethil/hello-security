import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { OPERATIONAL_ROLES } from '../../common/auth/constants';

import { patrolSessionController } from './patrol-session.controller';

const router: Router = Router();

router.post(
  '/start',
  authenticate,
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR, UserRole.MANAGER),
  patrolSessionController.start.bind(patrolSessionController),
);

router.get(
  '/current',
  authenticate,
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR, UserRole.MANAGER),
  patrolSessionController.current.bind(patrolSessionController),
);

router.get(
  '/history',
  authenticate,
  authorize(...OPERATIONAL_ROLES, UserRole.SUPERVISOR, UserRole.MANAGER),
  patrolSessionController.history.bind(patrolSessionController),
);

router.post(
  '/:id/pause',
  authenticate,
  authorize(
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    ...OPERATIONAL_ROLES,
  ),
  patrolSessionController.pause.bind(patrolSessionController),
);

router.patch(
  '/:id/pause',
  authenticate,
  authorize(
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    ...OPERATIONAL_ROLES,
  ),
  patrolSessionController.pause.bind(patrolSessionController),
);

router.post(
  '/:id/resume',
  authenticate,
  authorize(
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    ...OPERATIONAL_ROLES,
  ),
  patrolSessionController.resume.bind(patrolSessionController),
);

router.patch(
  '/:id/resume',
  authenticate,
  authorize(
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    ...OPERATIONAL_ROLES,
  ),
  patrolSessionController.resume.bind(patrolSessionController),
);

router.post(
  '/:id/complete',
  authenticate,
  authorize(
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    ...OPERATIONAL_ROLES,
  ),
  patrolSessionController.complete.bind(patrolSessionController),
);

router.patch(
  '/:id/complete',
  authenticate,
  authorize(
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    ...OPERATIONAL_ROLES,
  ),
  patrolSessionController.complete.bind(patrolSessionController),
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, ...OPERATIONAL_ROLES),
  patrolSessionController.list.bind(patrolSessionController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, ...OPERATIONAL_ROLES),
  patrolSessionController.getById.bind(patrolSessionController),
);

router.patch(
  '/:id/verify',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  patrolSessionController.verify.bind(patrolSessionController),
);

export default router;
