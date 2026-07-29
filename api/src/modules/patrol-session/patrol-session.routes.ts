import { UserRole } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../common/auth/auth.middleware';
import { authorize } from '../../common/auth/authorize';

import { patrolSessionController } from './patrol-session.controller';

const router: Router = Router();

router.post(
  '/start',
  authenticate,
  authorize(UserRole.SECURITY, UserRole.SUPERVISOR, UserRole.MANAGER),
  patrolSessionController.start.bind(patrolSessionController),
);

router.get(
  '/current',
  authenticate,
  authorize(UserRole.SECURITY, UserRole.SUPERVISOR, UserRole.MANAGER),
  patrolSessionController.current.bind(patrolSessionController),
);

router.get(
  '/history',
  authenticate,
  authorize(UserRole.SECURITY, UserRole.SUPERVISOR, UserRole.MANAGER),
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
    UserRole.SECURITY,
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
    UserRole.SECURITY,
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
    UserRole.SECURITY,
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
    UserRole.SECURITY,
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
    UserRole.SECURITY,
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
    UserRole.SECURITY,
  ),
  patrolSessionController.complete.bind(patrolSessionController),
);

router.get(
  '/',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SECURITY),
  patrolSessionController.list.bind(patrolSessionController),
);

router.get(
  '/:id',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.SECURITY),
  patrolSessionController.getById.bind(patrolSessionController),
);

router.patch(
  '/:id/verify',
  authenticate,
  authorize(UserRole.CLIENT_ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR),
  patrolSessionController.verify.bind(patrolSessionController),
);

export default router;
